import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { activateQuestion, stopQuestion, revealAnswer, endQuiz, SOCKET_URL } from '../api';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';
function authHeaders() {
  const token = localStorage.getItem('token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface AnswerOption { digit: number; text: string; }
interface Question { id: string; text: string; options: AnswerOption[]; correctAnswer: number; }
interface Distribution { [digit: number]: { count: number; percentage: number }; }
interface Results { questionId: string; totalParticipants: number; answeredCount: number; unansweredCount: number; distribution: Distribution; correctAnswer?: number; }

export default function DashboardPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [participants, setParticipants] = useState(0);
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);

  async function loadQuestions() {
    const quiz = await fetch(`${BASE}/api/quizzes/${quizId}`, { headers: authHeaders() }).then(r => r.json());
    if (quiz.questions?.length > 0) {
      const qs = await fetch(`${BASE}/api/questions`, { headers: authHeaders() }).then(r => r.json());
      const quizQIds = quiz.questions.map((qq: { questionId: string }) => qq.questionId);
      setAllQuestions(qs.filter((q: Question) => quizQIds.includes(q.id)));
    }
  }

  useEffect(() => {
    loadQuestions();
    const s = io(SOCKET_URL);
    setSocket(s);
    s.on('quiz:participant-count', ({ count }: { count: number }) => setParticipants(count));
    s.on('quiz:question-activated', ({ question }: { question: Question }) => {
      setActiveQuestion(question); setResults(null); setRevealed(false);
    });
    s.on('quiz:results-update', (r: Results) => setResults(r));
    s.on('quiz:answer-revealed', () => setRevealed(true));
    s.on('quiz:ended', () => navigate(`/reports/${quizId}`));
    return () => { s.disconnect(); };
  }, [quizId, navigate]);

  async function handleActivate(qid: string) {
    await activateQuestion(quizId!, qid);
  }

  async function handleStop() {
    if (activeQuestion) await stopQuestion(quizId!, activeQuestion.id);
  }
  async function handleReveal() {
    if (activeQuestion) { await revealAnswer(quizId!, activeQuestion.id); setRevealed(true); }
  }
  async function handleEnd() {
    await endQuiz(quizId!);
  }

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <button onClick={() => navigate('/quizzes')} style={styles.backBtn}>← חזור</button>
        <span style={styles.title}>לוח בקרה</span>
        <button onClick={handleEnd} style={styles.endBtn}>סיים חידון</button>
      </nav>

      <div style={styles.container}>
        <div style={styles.statsBar}>
          <div style={styles.stat}>
            <span style={styles.statLabel}>משתתפים מחוברים</span>
            <span style={styles.statValue}>{participants}</span>
          </div>
        </div>

        {activeQuestion ? (
          <div style={styles.activeCard}>
            <h3>שאלה פעילה</h3>
            <p style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>{activeQuestion.text}</p>
            <div style={{ marginBottom: 16 }}>
              {activeQuestion.options.map(o => {
                const dist = results?.distribution[o.digit];
                const isCorrect = o.digit === activeQuestion.correctAnswer;
                return (
                  <div key={o.digit} style={{
                    ...styles.optionRow,
                    background: revealed && isCorrect ? '#d4edda' : '#f8f9fa',
                    border: revealed && isCorrect ? '2px solid #28a745' : '1px solid #ddd'
                  }}>
                    <span style={{ ...styles.digit, background: revealed && isCorrect ? '#28a745' : '#007bff' }}>{o.digit}</span>
                    <span style={{ flex: 1 }}>{o.text}</span>
                    {dist && <span style={styles.count}>{dist.count} ({dist.percentage.toFixed(0)}%)</span>}
                  </div>
                );
              })}
            </div>
            {results && (
              <p style={{ color: '#666', marginBottom: 16 }}>
                ענו: {results.answeredCount} | לא ענו: {results.unansweredCount}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleStop} style={styles.stopBtn}>עצור שאלה</button>
              <button onClick={handleReveal} disabled={revealed} style={styles.revealBtn}>
                {revealed ? 'התשובה נחשפה' : 'חשוף תשובה'}
              </button>
            </div>
          </div>
        ) : (
          <div style={styles.waitingCard}>
            <h3>בחר שאלה להפעלה</h3>
            {allQuestions.length === 0 && <p style={{ color: '#888' }}>אין שאלות בחידון</p>}
            {allQuestions.map((q, i) => (
              <div key={q.id} style={styles.qSelectRow}>
                <div style={{ flex: 1 }}>
                  <strong>{i + 1}. {q.text}</strong>
                  <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                    {q.options.map(o => `${o.digit}. ${o.text}`).join(' | ')}
                  </div>
                </div>
                <button onClick={() => handleActivate(q.id)} style={styles.activateBtn}>הפעל</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f5f5f5', direction: 'rtl' },
  nav: { background: '#fff', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  backBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#007bff' },
  title: { fontSize: 18, fontWeight: 'bold' },
  endBtn: { background: '#dc3545', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 4, cursor: 'pointer', fontSize: 15 },
  container: { maxWidth: 900, margin: '24px auto', padding: '0 16px' },
  statsBar: { background: '#fff', padding: 16, borderRadius: 8, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', gap: 24 },
  stat: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  statLabel: { fontSize: 13, color: '#666' },
  statValue: { fontSize: 28, fontWeight: 'bold', color: '#007bff' },
  activeCard: { background: '#fff', padding: 24, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '2px solid #007bff' },
  waitingCard: { background: '#fff', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  optionRow: { padding: '12px', borderRadius: 4, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 },
  digit: { width: 28, height: 28, color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 },
  count: { fontWeight: 'bold', color: '#007bff' },
  stopBtn: { background: '#ffc107', color: '#000', border: 'none', padding: '10px 20px', borderRadius: 4, cursor: 'pointer', fontSize: 15 },
  revealBtn: { background: '#28a745', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 4, cursor: 'pointer', fontSize: 15 },
  qSelectRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderBottom: '1px solid #eee' },
  activateBtn: { background: '#007bff', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', fontSize: 14 },
};
