import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getReport, SOCKET_URL } from '../api';

interface QuestionReport { questionText: string; correctAnswer: number; totalAnswered: number; totalUnanswered: number; successRate: number; distribution: Record<number, number>; }
interface QuizReport { quizName: string; startedAt: string; endedAt: string; totalParticipants: number; questionReports: QuestionReport[]; }

export default function ReportsPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const [report, setReport] = useState<QuizReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReport(quizId!).then(r => { setReport(r); setLoading(false); }).catch(() => setLoading(false));
  }, [quizId]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', direction: 'rtl' }}>טוען דוח...</div>;
  if (!report) return <div style={{ padding: 40, textAlign: 'center', direction: 'rtl' }}>אין דוח זמין עדיין לחידון זה.</div>;

  const questions = report.questionReports ?? [];

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: 24, direction: 'rtl' }}>
      <h2>דוח: {report.quizName}</h2>
      <p>משתתפים: {report.totalParticipants}</p>
      <a href={`${SOCKET_URL}/api/reports/${quizId}/export/csv`} download>ייצוא CSV</a>
      {questions.map((q, i) => (
        <div key={i} style={{ border: '1px solid #ccc', padding: 12, marginTop: 12 }}>
          <strong>{q.questionText}</strong>
          <p>ענו: {q.totalAnswered} | לא ענו: {q.totalUnanswered} | הצלחה: {q.successRate.toFixed(1)}%</p>
          <ul>
            {[1,2,3,4].filter(d => q.distribution[d] !== undefined).map(d => (
              <li key={d} style={{ fontWeight: d === q.correctAnswer ? 'bold' : 'normal' }}>
                {d}: {q.distribution[d]} תשובות {d === q.correctAnswer ? '✓' : ''}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
