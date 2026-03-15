import crypto from 'crypto';
import { SessionRecord } from '@trivia/shared';
import * as sessionStore from '../db/sessionStore';

function hashCallerNumber(callerNumber: string): string {
  return crypto.createHash('sha256').update(callerNumber).digest('hex');
}

export async function createSession(
  callSid: string,
  callerNumber: string,
  quizId: string
): Promise<SessionRecord> {
  const record: SessionRecord = {
    sessionId: crypto.randomUUID(),
    callSid,
    callerHash: hashCallerNumber(callerNumber),
    quizId,
    status: 'active',
    connectedAt: new Date().toISOString(),
    answers: {},
    answeredCurrentQuestion: false,
  };

  await sessionStore.createSession(record);
  return record;
}

export async function getSession(callSid: string): Promise<SessionRecord | null> {
  return sessionStore.getSession(callSid);
}

export async function recordAnswer(
  callSid: string,
  questionId: string,
  digit: number
): Promise<void> {
  const session = await sessionStore.getSession(callSid);
  if (!session) return;

  // אידמפוטנטי: אם כבר ענה לשאלה הנוכחית, התעלם
  if (session.answeredCurrentQuestion) return;

  await sessionStore.updateSession(callSid, {
    answers: { ...session.answers, [questionId]: digit },
    answeredCurrentQuestion: true,
  });
}

export async function resetForNextQuestion(callSid: string): Promise<void> {
  await sessionStore.updateSession(callSid, { answeredCurrentQuestion: false });
}

export async function closeSession(callSid: string): Promise<void> {
  await sessionStore.updateSession(callSid, { status: 'inactive' });
}

export async function getActiveCount(): Promise<number> {
  return sessionStore.getActiveSessionCount();
}

export async function closeAllSessions(): Promise<void> {
  return sessionStore.closeAllSessions();
}
