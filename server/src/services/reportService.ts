import { query } from '../db/db';
import { QuizReport, QuestionReport } from '../types';

export async function saveQuizReport(report: QuizReport): Promise<void> {
  await query(
    `INSERT INTO quiz_reports (quiz_id, report_data) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [report.quizId, JSON.stringify(report)]
  );
}

export async function getQuizReport(quizId: string): Promise<QuizReport | null> {
  const result = await query(
    `SELECT report_data FROM quiz_reports WHERE quiz_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [quizId]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0].report_data as QuizReport;
}

export async function getAllReports(): Promise<QuizReport[]> {
  const result = await query(
    `SELECT report_data FROM quiz_reports ORDER BY created_at DESC`
  );
  return result.rows.map((r) => r.report_data as QuizReport);
}

export function exportToCsv(report: QuizReport): string {
  const lines: string[] = [];
  lines.push('Quiz Name,Started At,Ended At,Total Participants');
  lines.push(
    `"${report.quizName}","${report.startedAt}","${report.endedAt}",${report.totalParticipants}`
  );
  lines.push('');
  lines.push('Question,Correct Answer,Total Answered,Total Unanswered,Success Rate %,1,2,3,4');

  for (const q of report.questionReports) {
    const dist = [1, 2, 3, 4].map((d) => q.distribution[d] ?? 0).join(',');
    lines.push(
      `"${q.questionText}",${q.correctAnswer},${q.totalAnswered},${q.totalUnanswered},${q.successRate.toFixed(1)},${dist}`
    );
  }

  return lines.join('\n');
}

export function buildQuizReport(
  quizId: string,
  quizName: string,
  startedAt: Date,
  questionReports: QuestionReport[],
  totalParticipants: number
): QuizReport {
  return {
    quizId,
    quizName,
    startedAt,
    endedAt: new Date(),
    totalParticipants,
    questionReports,
  };
}
