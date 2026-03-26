import { Server } from 'socket.io';
import { Quiz, Question, QuestionResults, LeaderboardEntry } from '../types';
import * as quizRepository from '../repositories/quizRepository';
import * as questionRepository from '../repositories/questionRepository';
import * as sessionManager from './sessionManager';
import { getAllActiveSessions } from '../db/sessionStore';
import { query } from '../db/db';

const TIMER_SECONDS = 10;

interface QuizState {
  activeQuestionId: string | null;
  questionStatus: 'active' | 'stopped' | null;
  revealedQuestions: string[];
  questionStartedAt: number | null;
  questionIndex: number;
  totalQuestions: number;
}

// In-memory state - no Redis needed for quiz state
const quizStates = new Map<string, QuizState>();

let io: Server | null = null;
const timerIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();

function getQuizState(quizId: string): QuizState {
  return quizStates.get(quizId) ?? {
    activeQuestionId: null,
    questionStatus: null,
    revealedQuestions: [],
    questionStartedAt: null,
    questionIndex: 0,
    totalQuestions: 0,
  };
}

function setQuizState(quizId: string, state: QuizState): void {
  quizStates.set(quizId, state);
}

function deleteQuizState(quizId: string): void {
  quizStates.delete(quizId);
}

export function getActiveQuestionId(quizId: string): string | null {
  return quizStates.get(quizId)?.activeQuestionId ?? null;
}

export function initialize(ioServer: Server): void {
  io = ioServer;
}

function stopTimer(quizId: string): void {
  const interval = timerIntervals.get(quizId);
  if (interval) {
    clearInterval(interval);
    timerIntervals.delete(quizId);
  }
}

function startTimer(quizId: string, questionId: string): void {
  stopTimer(quizId);
  let secondsLeft = TIMER_SECONDS;

  const interval = setInterval(async () => {
    secondsLeft--;
    io?.to(quizId).emit('quiz:timer-tick', { secondsLeft });

    if (secondsLeft <= 0) {
      stopTimer(quizId);
      await stopQuestion(quizId);
      await revealAnswer(quizId, questionId);
    }
  }, 1000);

  timerIntervals.set(quizId, interval);
}

export async function activateQuestion(quizId: string, questionId: string): Promise<void> {
  const question = await questionRepository.getQuestion(questionId);
  if (!question) throw new Error(`Question ${questionId} not found`);

  const quiz = await quizRepository.getQuiz(quizId);
  const totalQuestions = quiz?.questions?.length ?? 0;

  const state = getQuizState(quizId);
  const questionIndex = state.questionIndex + (state.activeQuestionId ? 1 : 0);

  state.activeQuestionId = questionId;
  state.questionStatus = 'active';
  state.questionStartedAt = Date.now();
  state.questionIndex = questionIndex;
  state.totalQuestions = totalQuestions;
  setQuizState(quizId, state);

  // Reset answeredCurrentQuestion for all active sessions
  const sessions = await getAllActiveSessions();
  await Promise.all(
    sessions
      .filter((s) => s.quizId === quizId)
      .map((s) => sessionManager.resetForNextQuestion(s.callSid))
  );

  io?.emit('quiz:question-activated', {
    questionId,
    question,
    questionIndex,
    totalQuestions,
    timerSeconds: TIMER_SECONDS,
  });

  startTimer(quizId, questionId);
}

export async function stopQuestion(quizId: string): Promise<void> {
  stopTimer(quizId);
  const state = getQuizState(quizId);
  const questionId = state.activeQuestionId;

  state.questionStatus = 'stopped';
  setQuizState(quizId, state);

  io?.emit('quiz:question-stopped', { questionId });
}

export async function revealAnswer(quizId: string, questionId: string): Promise<void> {
  const question = await questionRepository.getQuestion(questionId);
  if (!question) throw new Error(`Question ${questionId} not found`);

  const state = getQuizState(quizId);
  if (!state.revealedQuestions.includes(questionId)) {
    state.revealedQuestions.push(questionId);
    setQuizState(quizId, state);
  }

  const sessions = await getAllActiveSessions();
  const quizSessions = sessions.filter((s) => s.quizId === quizId);
  const correctSessions = quizSessions.filter((s) => s.answers[questionId] === question.correctAnswer);
  const correctCount = correctSessions.length;
  const totalAnswered = quizSessions.filter((s) => s.answers[questionId] !== undefined).length;

  // Find fastest correct answerer
  let fastestName: string | null = null;
  let fastestMs: number | null = null;

  if (correctSessions.length > 0) {
    const { rows: participants } = await query(
      `SELECT id, name, phone FROM participants WHERE quiz_id = $1`,
      [quizId]
    );
    let fastest: { name: string; ms: number } | null = null;
    for (const session of correctSessions) {
      const ms = session.answerTimestamps?.[questionId];
      if (ms === undefined) continue;
      const normalizedCaller = session.callerHash;
      const participant = participants.find((p: { phone: string }) =>
        normalizedCaller.endsWith(p.phone.replace(/\D/g, '').slice(-9))
      );
      if (participant && (fastest === null || ms < fastest.ms)) {
        fastest = { name: participant.name, ms };
      }
    }
    if (fastest) {
      fastestName = fastest.name;
      fastestMs = fastest.ms;
    }
  }

  await awardPoints(quizId, questionId, question.correctAnswer, state.questionStartedAt);

  io?.emit('quiz:answer-revealed', {
    questionId,
    correctAnswer: question.correctAnswer,
    correctCount,
    totalAnswered,
    fastestName,
    fastestMs,
  });

  const showLeaderboard = state.revealedQuestions.length % 5 === 0;
  if (showLeaderboard) {
    const leaderboard = await getLeaderboard(quizId);
    io?.emit('quiz:leaderboard', { entries: leaderboard });
  }

  // Auto-advance: after 4 seconds (or 6 if leaderboard), activate next question
  const delay = showLeaderboard ? 6000 : 4000;
  setTimeout(async () => {
    const quiz = await quizRepository.getQuiz(quizId);
    if (!quiz) return;
    const currentState = getQuizState(quizId);
    if (currentState.questionStatus !== 'stopped') return; // was manually ended

    const orderedIds = quiz.questions
      .sort((a, b) => a.order - b.order)
      .map(q => q.questionId);

    const nextIndex = currentState.revealedQuestions.length;
    if (nextIndex >= orderedIds.length) {
      // All questions done — end quiz
      await endQuiz(quizId);
    } else {
      await activateQuestion(quizId, orderedIds[nextIndex]);
    }
  }, delay);
}

async function awardPoints(quizId: string, questionId: string, correctAnswer: number, questionStartedAt: number | null): Promise<void> {
  const { rows: participants } = await query(
    `SELECT id, phone FROM participants WHERE quiz_id = $1`,
    [quizId]
  );
  if (participants.length === 0) return;

  const sessions = await getAllActiveSessions();
  const quizSessions = sessions.filter((s) => s.quizId === quizId);

  for (const participant of participants) {
    const normalizedPhone = participant.phone.replace(/\D/g, '').slice(-9);
    const session = quizSessions.find((s) => s.callerHash.endsWith(normalizedPhone));
    const answer = session?.answers[questionId];
    if (answer === undefined) continue;

    const isCorrect = answer === correctAnswer;
    let points = 0;
    const answeredAtMs = session?.answerTimestamps?.[questionId] ?? null;
    if (isCorrect && answeredAtMs !== null) {
      const elapsedSeconds = answeredAtMs / 1000;
      points = Math.max(50, Math.round(150 - elapsedSeconds * 10));
    }

    const existing = await query(
      `SELECT id FROM participant_scores WHERE participant_id = $1 AND question_id = $2`,
      [participant.id, questionId]
    );
    if (existing.rows.length > 0) continue;

    await query(
      `INSERT INTO participant_scores (participant_id, quiz_id, question_id, answer, is_correct, points, answered_at_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [participant.id, quizId, questionId, answer, isCorrect, points, answeredAtMs]
    );
  }
}

export async function getLeaderboard(quizId: string): Promise<LeaderboardEntry[]> {
  const { rows } = await query(
    `SELECT p.id, p.name,
       COALESCE(SUM(ps.points), 0) as total_points,
       COALESCE(SUM(CASE WHEN ps.is_correct THEN 1 ELSE 0 END), 0) as correct_answers
     FROM participants p
     LEFT JOIN participant_scores ps ON ps.participant_id = p.id
     WHERE p.quiz_id = $1
     GROUP BY p.id, p.name
     ORDER BY total_points DESC, correct_answers DESC
     LIMIT 10`,
    [quizId]
  );
  return rows.map((r, i) => ({
    rank: i + 1,
    participantId: r.id,
    name: r.name,
    totalPoints: Number(r.total_points),
    correctAnswers: Number(r.correct_answers),
  }));
}

export async function endQuiz(quizId: string): Promise<void> {
  stopTimer(quizId);

  // Build and save report before clearing state
  try {
    const quiz = await quizRepository.getQuiz(quizId);
    const state = getQuizState(quizId);
    const { rows: participants } = await query(
      `SELECT id, name FROM participants WHERE quiz_id = $1`, [quizId]
    );
    const { rows: scores } = await query(
      `SELECT ps.question_id, ps.answer, ps.is_correct, ps.points, q.text, q.correct_answer
       FROM participant_scores ps
       JOIN questions q ON q.id = ps.question_id
       WHERE ps.quiz_id = $1`, [quizId]
    );

    // Group scores by question
    const byQuestion: Record<string, { text: string; correctAnswer: number; answers: { answer: number; isCorrect: boolean }[] }> = {};
    for (const row of scores) {
      if (!byQuestion[row.question_id]) {
        byQuestion[row.question_id] = { text: row.text, correctAnswer: row.correct_answer, answers: [] };
      }
      byQuestion[row.question_id].answers.push({ answer: row.answer, isCorrect: row.is_correct });
    }

    const questionReports = Object.values(byQuestion).map(q => {
      const dist: Record<number, number> = {};
      for (const a of q.answers) dist[a.answer] = (dist[a.answer] ?? 0) + 1;
      const correct = q.answers.filter(a => a.isCorrect).length;
      return {
        questionText: q.text,
        correctAnswer: q.correctAnswer,
        totalAnswered: q.answers.length,
        totalUnanswered: Math.max(0, participants.length - q.answers.length),
        successRate: q.answers.length > 0 ? (correct / q.answers.length) * 100 : 0,
        distribution: dist,
      };
    });

    await query(
      `INSERT INTO quiz_reports (quiz_id, report_data) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [quizId, JSON.stringify({
        quizId,
        quizName: quiz?.name ?? 'חידון',
        startedAt: new Date(),
        endedAt: new Date(),
        totalParticipants: participants.length,
        questionReports,
      })]
    );
  } catch (e) {
    console.error('Failed to save report:', e);
  }

  await quizRepository.updateQuizStatus(quizId, 'ended');
  await sessionManager.closeAllSessions();

  const leaderboard = await getLeaderboard(quizId);
  const winner = leaderboard.length > 0 ? leaderboard[0] : null;

  deleteQuizState(quizId);

  io?.emit('quiz:ended', { winner });
}

export async function getActiveQuiz(): Promise<Quiz | null> {
  return quizRepository.getActiveQuiz();
}

export async function startQuiz(quizId: string): Promise<void> {
  await quizRepository.updateQuizStatus(quizId, 'active');
  const quiz = await quizRepository.getQuiz(quizId);
  if (!quiz || quiz.questions.length === 0) return;

  const orderedIds = quiz.questions
    .sort((a, b) => a.order - b.order)
    .map(q => q.questionId);

  // Initialize state
  quizStates.set(quizId, {
    activeQuestionId: null,
    questionStatus: null,
    revealedQuestions: [],
    questionStartedAt: null,
    questionIndex: 0,
    totalQuestions: orderedIds.length,
  });

  // Small delay so client can connect to socket before first question
  setTimeout(() => activateQuestion(quizId, orderedIds[0]), 2000);
}

export async function getResults(quizId: string, questionId: string): Promise<QuestionResults> {
  const sessions = await getAllActiveSessions();
  const quizSessions = sessions.filter((s) => s.quizId === quizId);

  const totalParticipants = quizSessions.length;
  const distribution: Record<number, { count: number; percentage: number }> = {};
  let answeredCount = 0;

  for (const session of quizSessions) {
    const digit = session.answers[questionId];
    if (digit !== undefined) {
      answeredCount++;
      if (!distribution[digit]) distribution[digit] = { count: 0, percentage: 0 };
      distribution[digit].count++;
    }
  }

  for (const digit of Object.keys(distribution)) {
    const d = distribution[Number(digit)];
    d.percentage = answeredCount > 0 ? (d.count / answeredCount) * 100 : 0;
  }

  const unansweredCount = totalParticipants - answeredCount;
  const state = getQuizState(quizId);
  const isRevealed = state.revealedQuestions.includes(questionId);

  const results: QuestionResults = {
    questionId,
    quizId,
    totalParticipants,
    answeredCount,
    unansweredCount,
    distribution,
  };

  if (isRevealed) {
    const question = await questionRepository.getQuestion(questionId);
    if (question) results.correctAnswer = question.correctAnswer;
  }

  return results;
}

export async function recordAnswer(callSid: string, questionId: string, digit: number): Promise<boolean> {
  const session = await sessionManager.getSession(callSid);
  if (!session) return false;

  const state = getQuizState(session.quizId);
  if (state.activeQuestionId !== questionId || state.questionStatus !== 'active') return false;
  if (session.answeredCurrentQuestion) return false;

  const elapsedMs = state.questionStartedAt ? Date.now() - state.questionStartedAt : 0;
  await sessionManager.recordAnswer(callSid, questionId, digit, elapsedMs);

  // Find participant name for display
  const normalizedCaller = session.callerHash;
  const { rows: participants } = await query(
    `SELECT name, phone FROM participants WHERE quiz_id = $1`,
    [session.quizId]
  );
  const participant = participants.find((p: { phone: string }) =>
    normalizedCaller.endsWith(p.phone.replace(/\D/g, '').slice(-9))
  );
  const name = participant?.name ?? 'משתתף';

  io?.emit('quiz:participant-answered', { name, answeredAt: elapsedMs });

  const results = await getResults(session.quizId, questionId);
  io?.emit('quiz:results-update', results);

  return true;
}
