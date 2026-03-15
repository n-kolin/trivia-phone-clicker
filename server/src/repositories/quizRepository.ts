import { Quiz, QuizQuestion, ApiError, ErrorCodes } from '../../../shared/types/index';
import { query, getClient } from '../db/db';

export interface CreateQuizDto {
  name: string;
  description?: string;
  questionIds?: string[];
}

function rowToQuiz(row: Record<string, unknown>, questions: QuizQuestion[] = []): Quiz {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? '',
    status: row.status as 'draft' | 'active' | 'ended',
    questions,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

async function fetchQuizQuestions(quizId: string): Promise<QuizQuestion[]> {
  const result = await query(
    `SELECT question_id, order_index
     FROM quiz_questions
     WHERE quiz_id = $1
     ORDER BY order_index ASC`,
    [quizId]
  );
  return result.rows.map((r) => ({
    order: r.order_index as number,
    questionId: r.question_id as string,
  }));
}

export async function createQuiz(data: CreateQuizDto): Promise<Quiz> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO quizzes (name, description)
       VALUES ($1, $2)
       RETURNING *`,
      [data.name, data.description ?? null]
    );
    const quizRow = result.rows[0];

    const questions: QuizQuestion[] = [];
    if (data.questionIds && data.questionIds.length > 0) {
      for (let i = 0; i < data.questionIds.length; i++) {
        await client.query(
          `INSERT INTO quiz_questions (quiz_id, question_id, order_index)
           VALUES ($1, $2, $3)`,
          [quizRow.id, data.questionIds[i], i + 1]
        );
        questions.push({ order: i + 1, questionId: data.questionIds[i] });
      }
    }

    await client.query('COMMIT');
    return rowToQuiz(quizRow, questions);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getQuiz(id: string): Promise<Quiz | null> {
  const result = await query('SELECT * FROM quizzes WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  const questions = await fetchQuizQuestions(id);
  return rowToQuiz(result.rows[0], questions);
}

export async function getAllQuizzes(): Promise<Quiz[]> {
  const result = await query('SELECT * FROM quizzes ORDER BY created_at DESC');
  const quizzes = await Promise.all(
    result.rows.map(async (row) => {
      const questions = await fetchQuizQuestions(row.id as string);
      return rowToQuiz(row, questions);
    })
  );
  return quizzes;
}

export async function getActiveQuiz(): Promise<Quiz | null> {
  const result = await query("SELECT * FROM quizzes WHERE status = 'active' LIMIT 1");
  if (result.rows.length === 0) return null;
  const questions = await fetchQuizQuestions(result.rows[0].id as string);
  return rowToQuiz(result.rows[0], questions);
}

export async function updateQuizStatus(
  id: string,
  status: 'draft' | 'active' | 'ended'
): Promise<void> {
  await query(
    `UPDATE quizzes SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, id]
  );
}

export async function addQuestionToQuiz(
  quizId: string,
  questionId: string,
  order: number
): Promise<void> {
  await query(
    `INSERT INTO quiz_questions (quiz_id, question_id, order_index)
     VALUES ($1, $2, $3)
     ON CONFLICT (quiz_id, question_id) DO UPDATE SET order_index = $3`,
    [quizId, questionId, order]
  );
  await query('UPDATE quizzes SET updated_at = NOW() WHERE id = $1', [quizId]);
}

export async function removeQuestionFromQuiz(
  quizId: string,
  questionId: string
): Promise<void> {
  const statusResult = await query(
    "SELECT status FROM quizzes WHERE id = $1",
    [quizId]
  );

  if (statusResult.rows.length > 0 && statusResult.rows[0].status === 'active') {
    const err: ApiError = {
      code: ErrorCodes.QUESTION_IN_ACTIVE_QUIZ,
      message: 'Cannot remove a question from an active quiz',
      statusCode: 409,
    };
    throw err;
  }

  await query(
    'DELETE FROM quiz_questions WHERE quiz_id = $1 AND question_id = $2',
    [quizId, questionId]
  );
  await query('UPDATE quizzes SET updated_at = NOW() WHERE id = $1', [quizId]);
}

export async function reorderQuestions(
  quizId: string,
  questionIds: string[]
): Promise<void> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < questionIds.length; i++) {
      await client.query(
        `UPDATE quiz_questions SET order_index = $1
         WHERE quiz_id = $2 AND question_id = $3`,
        [i + 1, quizId, questionIds[i]]
      );
    }
    await client.query('UPDATE quizzes SET updated_at = NOW() WHERE id = $1', [quizId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteQuiz(id: string): Promise<boolean> {
  const statusResult = await query('SELECT status FROM quizzes WHERE id = $1', [id]);

  if (statusResult.rows.length === 0) return false;

  if (statusResult.rows[0].status === 'active') {
    const err: ApiError = {
      code: ErrorCodes.QUIZ_NOT_FOUND,
      message: 'Cannot delete an active quiz',
      statusCode: 409,
    };
    throw err;
  }

  const result = await query('DELETE FROM quizzes WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
