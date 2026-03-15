import { Server } from 'socket.io';
import { Quiz, Question, QuestionResults } from '../../../shared/types/index';
import * as quizRepository from '../repositories/quizRepository';
import * as questionRepository from '../repositories/questionRepository';
import * as sessionManager from './sessionManager';
import { redis } from '../db/sessionStore';
import { getAllActiveSessions } from '../db/sessionStore';

const QUIZ_STATE_PREFIX = 'quiz:state:';

interface QuizState {
  activeQuestionId: string | null;
  questionStatus: 'active' | 'stopped' | null;
  revealedQuestions: string[];
}

let io: Server | null = null;

function quizStateKey(quizId: string): string {
  return `${QUIZ_STATE_PREFIX}${quizId}`;
}

async function getQuizState(quizId: string): Promise<QuizState> {
  const data = await redis.get(quizStateKey(quizId));
  if (!data) {
    return { activeQuestionId: null, questionStatus: null, revealedQuestions: [] };
  }
  return JSON.parse(data) as QuizState;
}

async function setQuizState(quizId: string, state: QuizState): Promise<void> {
  await redis.set(quizStateKey(quizId), JSON.stringify(state));
}

async function deleteQuizState(quizId: string): Promise<void> {
  await redis.del(quizStateKey(quizId));
}

export function initialize(ioServer: Server): void {
  io = ioServer;
}

export async function activateQuestion(quizId: string, questionId: string): Promise<void> {
  const question = await questionRepository.getQuestion(questionId);
  if (!question) {
    throw new Error(`Question ${questionId} not found`);
  }

  const state = await getQuizState(quizId);
  state.activeQuestionId = questionId;
  state.questionStatus = 'active';
  await setQuizState(quizId, state);

  // Reset answeredCurrentQuestion for all active sessions
  const sessions = await getAllActiveSessions();
  await Promise.all(
    sessions
      .filter((s) => s.quizId === quizId)
      .map((s) => sessionManager.resetForNextQuestion(s.callSid))
  );

  io?.emit('quiz:question-activated', { questionId, question });
}

export async function stopQuestion(quizId: string): Promise<void> {
  const state = await getQuizState(quizId);
  const questionId = state.activeQuestionId;

  state.questionStatus = 'stopped';
  await setQuizState(quizId, state);

  io?.emit('quiz:question-stopped', { questionId });
}

export async function revealAnswer(quizId: string, questionId: string): Promise<void> {
  const question = await questionRepository.getQuestion(questionId);
  if (!question) {
    throw new Error(`Question ${questionId} not found`);
  }

  const state = await getQuizState(quizId);
  if (!state.revealedQuestions.includes(questionId)) {
    state.revealedQuestions.push(questionId);
    await setQuizState(quizId, state);
  }

  io?.emit('quiz:answer-revealed', { questionId, correctAnswer: question.correctAnswer });
}

export async function endQuiz(quizId: string): Promise<void> {
  await quizRepository.updateQuizStatus(quizId, 'ended');
  await sessionManager.closeAllSessions();
  await deleteQuizState(quizId);

  io?.emit('quiz:ended');
}

export async function getActiveQuiz(): Promise<Quiz | null> {
  return quizRepository.getActiveQuiz();
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
      if (!distribution[digit]) {
        distribution[digit] = { count: 0, percentage: 0 };
      }
      distribution[digit].count++;
    }
  }

  // Calculate percentages
  for (const digit of Object.keys(distribution)) {
    const d = distribution[Number(digit)];
    d.percentage = answeredCount > 0 ? (d.count / answeredCount) * 100 : 0;
  }

  const unansweredCount = totalParticipants - answeredCount;

  const state = await getQuizState(quizId);
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
    if (question) {
      results.correctAnswer = question.correctAnswer;
    }
  }

  return results;
}

export async function recordAnswer(
  callSid: string,
  questionId: string,
  digit: number
): Promise<boolean> {
  const state = await getQuizState(
    (await sessionManager.getSession(callSid))?.quizId ?? ''
  );

  // Check that there is an active question matching questionId
  if (state.activeQuestionId !== questionId || state.questionStatus !== 'active') {
    return false;
  }

  const session = await sessionManager.getSession(callSid);
  if (!session) return false;

  // Already answered
  if (session.answeredCurrentQuestion) return false;

  await sessionManager.recordAnswer(callSid, questionId, digit);

  // Broadcast updated results
  const results = await getResults(session.quizId, questionId);
  io?.emit('quiz:results-update', results);

  return true;
}
