// Shared TypeScript types for Phone Trivia Clicker

export interface AnswerOption {
  digit: number; // 1-4
  text: string;
}

export interface QuizQuestion {
  order: number;
  questionId: string;
}

export interface Quiz {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'ended';
  questions: QuizQuestion[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Question {
  id: string;
  text: string;
  options: AnswerOption[]; // 2-4 options
  correctAnswer: number;   // 1-4
  language: string;        // 'he' default
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionRecord {
  sessionId: string;
  callSid: string;
  callerHash: string;
  quizId: string;
  status: 'active' | 'inactive';
  connectedAt: string; // ISO string
  answers: Record<string, number>; // questionId -> digit
  answeredCurrentQuestion: boolean;
}

export interface QuestionResults {
  questionId: string;
  quizId: string;
  totalParticipants: number;
  answeredCount: number;
  unansweredCount: number;
  distribution: {
    [digit: number]: {
      count: number;
      percentage: number;
    };
  };
  correctAnswer?: number; // revealed only after reveal
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
  lastLoginAt: Date;
}

export interface QuestionReport {
  questionId: string;
  questionText: string;
  correctAnswer: number;
  totalAnswered: number;
  totalUnanswered: number;
  successRate: number; // percentage who answered correctly
  distribution: Record<number, number>;
}

export interface QuizReport {
  quizId: string;
  quizName: string;
  startedAt: Date;
  endedAt: Date;
  totalParticipants: number;
  questionReports: QuestionReport[];
}

// Webhook event types
export interface IncomingCallEvent {
  callSid: string;
  from: string;
  to: string;
  callStatus: string;
}

export interface DtmfEvent {
  callSid: string;
  digits: string;
  callStatus: string;
}

export interface CallStatusEvent {
  callSid: string;
  callStatus: 'completed' | 'busy' | 'no-answer' | 'failed';
}

export interface Participant {
  id: string;
  quizId: string;
  name: string;
  phone: string;
  createdAt: Date;
}

export interface ParticipantScore {
  participantId: string;
  name: string;
  totalPoints: number;
  correctAnswers: number;
}

export interface LeaderboardEntry {
  rank: number;
  participantId: string;
  name: string;
  totalPoints: number;
  correctAnswers: number;
}

// WebSocket server events
export interface ServerEvents {
  'quiz:participant-count': { count: number };
  'quiz:results-update': QuestionResults;
  'quiz:question-activated': { questionId: string; question: Question; questionIndex: number; totalQuestions: number; timerSeconds: number };
  'quiz:timer-tick': { secondsLeft: number };
  'quiz:question-stopped': { questionId: string };
  'quiz:answer-revealed': { questionId: string; correctAnswer: number; correctCount: number; totalAnswered: number };
  'quiz:leaderboard': { entries: LeaderboardEntry[] };
  'quiz:ended': { winner: LeaderboardEntry | null };
}

// API error type
export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
}

export const ErrorCodes = {
  QUIZ_NOT_FOUND: 'QUIZ_NOT_FOUND',
  QUESTION_IN_ACTIVE_QUIZ: 'QUESTION_IN_ACTIVE_QUIZ',
  INVALID_ANSWER_OPTIONS: 'INVALID_ANSWER_OPTIONS',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMITED: 'RATE_LIMITED',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
} as const;
