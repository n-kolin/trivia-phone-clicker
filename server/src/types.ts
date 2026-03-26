// Types (copied from shared to avoid build issues)

export interface AnswerOption {
  digit: number;
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
  options: AnswerOption[];
  correctAnswer: number;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionRecord {
  sessionId: string;
  callSid: string;
  callerHash: string;
  quizId: string;
  status: 'active' | 'inactive';
  connectedAt: string;
  answers: Record<string, number>;
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
  correctAnswer?: number;
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
  successRate: number;
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
