import { Router, Request, Response } from 'express';
import * as quizManager from '../services/quizManager';
import * as sessionManager from '../services/sessionManager';
import * as dtmfProcessor from '../services/dtmfProcessor';
import { query } from '../db/db';

const router = Router();

/**
 * מנגנון retry - מנסה עד 3 פעמים עם delay של שנייה
 */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.error(`Attempt ${attempt}/${maxAttempts} failed:`, err);
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }
  throw lastError;
}

/**
 * POST /webhook/call/incoming - שיחה נכנסת
 */
router.post('/call/incoming', async (req: Request, res: Response) => {
  try {
    const twiml = await withRetry(async () => {
      const { CallSid: callSid, From: from, To: to } = req.body;

      const quiz = await quizManager.getActiveQuiz();
      const hasActiveQuiz = quiz !== null;

      if (hasActiveQuiz && quiz) {
        await sessionManager.createSession(callSid, from, quiz.id);
      }

      return dtmfProcessor.buildWelcomeResponse(hasActiveQuiz);
    });

    res.set('Content-Type', 'text/xml');
    res.send(twiml);
  } catch (err) {
    console.error('Error handling incoming call after retries:', err);
    res.set('Content-Type', 'text/xml');
    res.send('<Response><Say language="he-IL">שגיאה בשירות. נסו שוב מאוחר יותר.</Say></Response>');
  }
});

/**
 * POST /webhook/call/dtmf - קבלת DTMF
 */
router.post('/call/dtmf', async (req: Request, res: Response) => {
  try {
    const twiml = await withRetry(async () => {
      const { CallSid: callSid, Digits: digits } = req.body;

      const session = await sessionManager.getSession(callSid);

      let activeQuestionId: string | null = null;
      if (session) {
        const quiz = await quizManager.getActiveQuiz();
        if (quiz) {
          // קבל את מזהה השאלה הפעילה מה-quizManager
          const quizState = await getActiveQuestionId(quiz.id);
          activeQuestionId = quizState;
        }
      }

      const result = await dtmfProcessor.processDigit(callSid, digits, activeQuestionId);
      return result.twiml;
    });

    res.set('Content-Type', 'text/xml');
    res.send(twiml);
  } catch (err) {
    console.error('Error handling DTMF after retries:', err);
    res.set('Content-Type', 'text/xml');
    res.send('<Response><Gather numDigits="1" timeout="30" action="/webhook/call/dtmf"></Gather></Response>');
  }
});

/**
 * POST /webhook/call/status - עדכון סטטוס שיחה
 */
router.post('/call/status', async (req: Request, res: Response) => {
  try {
    await withRetry(async () => {
      const { CallSid: callSid, CallStatus: callStatus } = req.body;

      const terminalStatuses = ['completed', 'failed', 'busy', 'no-answer'];
      if (terminalStatuses.includes(callStatus)) {
        const session = await sessionManager.getSession(callSid);

        await sessionManager.closeSession(callSid);

        if (session) {
          const questionsAnswered = Object.keys(session.answers).length;
          const disconnectedAt = new Date().toISOString();

          await query(
            `INSERT INTO call_logs (caller_hash, quiz_id, connected_at, disconnected_at, questions_answered)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              session.callerHash,
              session.quizId || null,
              session.connectedAt,
              disconnectedAt,
              questionsAnswered,
            ]
          );
        }
      }
    });

    res.status(200).send('OK');
  } catch (err) {
    console.error('Error handling call status after retries:', err);
    res.status(200).send('OK');
  }
});

/**
 * עזר: קבלת מזהה השאלה הפעילה מ-Redis דרך quizManager
 * מכיוון ש-quizManager לא חושף ישירות את activeQuestionId,
 * נשתמש ב-getResults עם שאלה ריקה כדי לקבל את המצב,
 * או נגש ישירות דרך sessionStore
 */
async function getActiveQuestionId(quizId: string): Promise<string | null> {
  // נגש ל-Redis ישירות דרך sessionStore
  const { redis } = await import('../db/sessionStore');
  const data = await redis.get(`quiz:state:${quizId}`);
  if (!data) return null;
  const state = JSON.parse(data) as { activeQuestionId: string | null; questionStatus: string | null };
  if (state.questionStatus !== 'active') return null;
  return state.activeQuestionId;
}

export default router;
