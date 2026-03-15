import { config } from '../config';
import * as quizManager from './quizManager';
import * as sessionManager from './sessionManager';

export interface ProcessResult {
  twiml: string;
  recorded: boolean;
}

/**
 * בניית TwiML לכניסה לחידון
 */
export function buildWelcomeResponse(hasActiveQuiz: boolean): string {
  if (hasActiveQuiz) {
    return `<Response>
  <Say language="he-IL">ברוכים הבאים לחידון. לחצו על מספר התשובה שלכם.</Say>
  <Gather numDigits="1" timeout="30" action="/webhook/call/dtmf">
  </Gather>
</Response>`;
  } else {
    return `<Response>
  <Say language="he-IL">אין חידון פעיל כרגע. נסו שוב מאוחר יותר.</Say>
</Response>`;
  }
}

/**
 * בניית TwiML לאישור קבלת הצבעה
 */
export function buildConfirmationResponse(): string {
  return `<Response>
  <Play>${config.sounds.confirm}</Play>
  <Gather numDigits="1" timeout="30" action="/webhook/call/dtmf">
  </Gather>
</Response>`;
}

/**
 * בניית TwiML לצליל תוצאה
 */
export function buildResultToneResponse(isCorrect: boolean): string {
  const sound = isCorrect ? config.sounds.correct : config.sounds.wrong;
  return `<Response>
  <Play>${sound}</Play>
  <Gather numDigits="1" timeout="30" action="/webhook/call/dtmf">
  </Gather>
</Response>`;
}

/**
 * בניית TwiML לסיום חידון
 */
export function buildEndOfQuizResponse(): string {
  return `<Response>
  <Say language="he-IL">החידון הסתיים. תודה על השתתפותכם.</Say>
</Response>`;
}

/**
 * Gather פתוח - ממתין לקלט
 */
function buildOpenGatherResponse(): string {
  return `<Response>
  <Gather numDigits="1" timeout="30" action="/webhook/call/dtmf">
  </Gather>
</Response>`;
}

/**
 * עיבוד ספרה מ-DTMF
 */
export async function processDigit(
  callSid: string,
  digit: string,
  activeQuestionId: string | null
): Promise<ProcessResult> {
  // אין שאלה פעילה - ממתין
  if (!activeQuestionId) {
    return { twiml: buildOpenGatherResponse(), recorded: false };
  }

  // ספרה לא תקינה (לא 1-4) - התעלם בשקט
  const digitNum = parseInt(digit, 10);
  if (isNaN(digitNum) || digitNum < 1 || digitNum > 4) {
    return { twiml: buildOpenGatherResponse(), recorded: false };
  }

  // ספרה תקינה - רשום תשובה
  const recorded = await quizManager.recordAnswer(callSid, activeQuestionId, digitNum);

  return {
    twiml: buildConfirmationResponse(),
    recorded,
  };
}
