import { Question, AnswerOption, ApiError, ErrorCodes } from '../types';
import { query } from '../db/db';

export interface CreateQuestionDto {
  text: string;
  options: AnswerOption[];
  correctAnswer: number;
  language?: string;
}

function validateOptions(options: AnswerOption[], correctAnswer: number): void {
  if (options.length < 2 || options.length > 4) {
    const err: ApiError = {
      code: ErrorCodes.INVALID_ANSWER_OPTIONS,
      message: 'Question must have between 2 and 4 answer options',
      statusCode: 400,
    };
    throw err;
  }

  const digits = options.map((o) => o.digit);
  if (!digits.includes(correctAnswer)) {
    const err: ApiError = {
      code: ErrorCodes.INVALID_ANSWER_OPTIONS,
      message: 'correctAnswer must match one of the option digits',
      statusCode: 400,
    };
    throw err;
  }
}

function rowToQuestion(row: Record<string, unknown>): Question {
  return {
    id: row.id as string,
    text: row.text as string,
    options: row.options as AnswerOption[],
    correctAnswer: row.correct_answer as number,
    language: row.language as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export async function createQuestion(data: CreateQuestionDto): Promise<Question> {
  validateOptions(data.options, data.correctAnswer);

  const result = await query(
    `INSERT INTO questions (text, options, correct_answer, language)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.text, JSON.stringify(data.options), data.correctAnswer, data.language ?? 'he']
  );

  return rowToQuestion(result.rows[0]);
}

export async function getQuestion(id: string): Promise<Question | null> {
  const result = await query('SELECT * FROM questions WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  return rowToQuestion(result.rows[0]);
}

export async function getAllQuestions(): Promise<Question[]> {
  const result = await query('SELECT * FROM questions ORDER BY created_at DESC');
  return result.rows.map(rowToQuestion);
}

export async function updateQuestion(
  id: string,
  data: Partial<CreateQuestionDto>
): Promise<Question | null> {
  const existing = await getQuestion(id);
  if (!existing) return null;

  const mergedOptions = data.options ?? existing.options;
  const mergedCorrectAnswer = data.correctAnswer ?? existing.correctAnswer;

  if (data.options !== undefined || data.correctAnswer !== undefined) {
    validateOptions(mergedOptions, mergedCorrectAnswer);
  }

  const result = await query(
    `UPDATE questions
     SET text = $1,
         options = $2,
         correct_answer = $3,
         language = $4,
         updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [
      data.text ?? existing.text,
      JSON.stringify(mergedOptions),
      mergedCorrectAnswer,
      data.language ?? existing.language,
      id,
    ]
  );

  if (result.rows.length === 0) return null;
  return rowToQuestion(result.rows[0]);
}

export async function deleteQuestion(id: string): Promise<boolean> {
  // Check if question is associated with an active quiz
  const activeCheck = await query(
    `SELECT qq.quiz_id
     FROM quiz_questions qq
     JOIN quizzes q ON q.id = qq.quiz_id
     WHERE qq.question_id = $1 AND q.status = 'active'
     LIMIT 1`,
    [id]
  );

  if (activeCheck.rows.length > 0) {
    const err: ApiError = {
      code: ErrorCodes.QUESTION_IN_ACTIVE_QUIZ,
      message: 'Cannot delete a question that is part of an active quiz',
      statusCode: 409,
    };
    throw err;
  }

  const result = await query('DELETE FROM questions WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
