import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { startQuiz } from '../api';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';
function authHeaders() {
  const token = localStorage.getItem('token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface AnswerOption { digit: number; text: string; }
interface Question { id?: string; text: string; options: AnswerOption[]; correctAnswer: number; saved?: boolean; }
interface Quiz { id: string; name: string; status: string; questions: { questionId: string; order: number }[]; }

export default function QuizEditPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [savedQuestions, setSavedQuestions] = useState<Question[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<Question[]>([]);

  // form state
  const [text, setText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correct, setCorrect] = useState(1);
  const [optCount, setOptCount] = useState(4);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadQuiz() {
    const q = await fetch(`${BASE}/api/quizzes/${quizId}`, { headers: authHeaders() }).then(r => r.json());
    setQuiz(q);
    if (q.questions?.length > 0) {
      const qs = await fetch(`${BASE}/api/questions`, { headers: authHeaders() }).then(r => r.json());
      const quizQIds = q.questions.map((qq: { questionId: string }) => qq.questionId);
      setSavedQuestions(qs.filter((qq: Question & { id: string }) => quizQIds.includes(qq.id)));
    }
  }

  useEffect(() => { loadQuiz(); }, [quizId]);

  function handleAddToPending(e: React.FormEvent) {
    e.preventDefault();
    const opts = options.slice(0, optCount).map((t, i) => ({ digit: i + 1, text: t }));
    setPendingQuestions(prev => [...prev, { text, options: opts, correctAnswer: correct }]);
    setText(''); setOptions(['', '', '', '']); setCorrect(1);
  }

  async function handleSaveAll() {
    if (pendingQuestions.length === 0) return;
    setSaving(true);
    setError('');
    try {
      const currentOrder = (quiz?.questions?.length || 0) + savedQuestions.length;
      for (let i = 0; i < pendingQuestions.length; i++) {
        const q = pendingQuestions[i];
        const created = await fetch(`${BASE}/api/questions`, {
          method: 'POST', headers: authHeaders(),
          body: JSON.stringify(q)
        }).then(r => r.json());
        await fetch(`${BASE}/api/quizzes/${quizId}/questions`, {
          method: 'POST', headers: authHeaders(),
          body: JSON.stringify({ questionId: created.id, order: currentOrder + i + 1 })
        });
      }
      setPendingQuestions([]);
      await loadQuiz();
    } catch { setError('שגיאה בשמירה'); }
    setSaving(false);
  }

  async function handleRemoveSaved(questionId: string) {
    await fetch(`${BASE}/api/quizzes/${quizId}/questions/${questionId}`, {
      method: 'DELETE', headers: authHeaders()
    });
    await loadQuiz();
  }

  async function handleStart() {
    if (pendingQuestions.length > 0) await handleSaveAll();
    await startQuiz(quizId!);
    navigate(`/dashboard/${quizId}`);
  }

  const totalQuestions = savedQuestions.length + pendingQuestions.length;

  if (!quiz) return <div style={{ padding: 40, textAlign: 'center' }}>טוען...</div>;

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <button onClick={() => navigate('/quizzes')} style={styles.backBtn}>← חזור</button>
        <span style={styles.title}>{quiz.name} — {totalQuestions} שאלות</span>
        <button onClick={handleStart} style={styles.startBtn} disabled={totalQuestions === 0}>
          התחל חידון ▶
        </button>
      </nav>

      <div style={styles.container}>
        <div style={styles.split}>
          {/* Form */}
          <div style={styles.card}>
            <h3>הוסף שאלה</h3>
            <form onSubmit={handleAddToPending} style={styles.form}>
              <textarea
                placeholder="נוסח השאלה"
                value={text}
                onChange={e => setText(e.target.value)}
                required
                style={{ ...styles.input, minHeight: 70, resize: 'vertical' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label>אפשרויות:</label>
                <select value={optCount} onChange={e => setOptCount(Number(e.target.value))} style={styles.select}>
                  {[2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              {options.slice(0, optCount).map((opt, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ ...styles.digit, background: i + 1 === correct ? '#28a745' : '#007bff' }}>{i + 1}</span>
                  <input
                    placeholder={`אפשרות ${i + 1}`}
                    value={opt}
                    onChange={e => { const o = [...options]; o[i] = e.target.value; setOptions(o); }}
                    required
                    style={{ ...styles.input, flex: 1 }}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label>תשובה נכונה:</label>
                <select value={correct} onChange={e => setCorrect(Number(e.target.value))} style={styles.select}>
                  {Array.from({ length: optCount }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                </select>
              </div>
              <button type="submit" style={styles.addBtn}>+ הוסף לרשימה</button>
            </form>

            {pendingQuestions.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ background: '#fff3cd', padding: 12, borderRadius: 4, marginBottom: 8 }}>
                  {pendingQuestions.length} שאלות ממתינות לשמירה
                </div>
                {error && <p style={{ color: 'red' }}>{error}</p>}
                <button onClick={handleSaveAll} disabled={saving} style={styles.saveBtn}>
                  {saving ? 'שומר...' : `💾 שמור ${pendingQuestions.length} שאלות`}
                </button>
              </div>
            )}
          </div>

          {/* Questions list */}
          <div style={styles.card}>
            <h3>שאלות ({totalQuestions})</h3>
            {totalQuestions === 0 && <p style={{ color: '#888', textAlign: 'center', padding: 20 }}>הוסף שאלות מהטופס</p>}

            {savedQuestions.map((q, i) => (
              <div key={q.id} style={styles.qRow}>
                <div style={{ flex: 1 }}>
                  <strong>{i + 1}. {q.text}</strong>
                  <div>{q.options.map(o => (
                    <span key={o.digit} style={{ marginLeft: 8, fontSize: 13, color: o.digit === q.correctAnswer ? '#28a745' : '#666' }}>
                      {o.digit === q.correctAnswer ? '✓' : '○'} {o.text}
                    </span>
                  ))}</div>
                </div>
                <button onClick={() => handleRemoveSaved(q.id!)} style={styles.removeBtn}>✕</button>
              </div>
            ))}

            {pendingQuestions.map((q, i) => (
              <div key={i} style={{ ...styles.qRow, background: '#f8f9fa', border: '1px dashed #ccc' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 11, color: '#888' }}>לא נשמר</span>
                  <strong style={{ display: 'block' }}>{savedQuestions.length + i + 1}. {q.text}</strong>
                  <div>{q.options.map(o => (
                    <span key={o.digit} style={{ marginLeft: 8, fontSize: 13, color: o.digit === q.correctAnswer ? '#28a745' : '#666' }}>
                      {o.digit === q.correctAnswer ? '✓' : '○'} {o.text}
                    </span>
                  ))}</div>
                </div>
                <button onClick={() => setPendingQuestions(prev => prev.filter((_, j) => j !== i))} style={styles.removeBtn}>✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f5f5f5', direction: 'rtl' },
  nav: { background: '#fff', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  backBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#007bff' },
  title: { fontSize: 18, fontWeight: 'bold' },
  startBtn: { background: '#28a745', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 4, cursor: 'pointer', fontSize: 15 },
  container: { maxWidth: 1100, margin: '24px auto', padding: '0 16px' },
  split: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 },
  card: { background: '#fff', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  form: { display: 'flex', flexDirection: 'column', gap: 10 },
  input: { padding: '9px 12px', border: '1px solid #ddd', borderRadius: 4, fontSize: 15, width: '100%', boxSizing: 'border-box' },
  select: { padding: '8px 12px', border: '1px solid #ddd', borderRadius: 4, fontSize: 15 },
  digit: { width: 26, height: 26, color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 },
  addBtn: { background: '#007bff', color: '#fff', border: 'none', padding: '10px', borderRadius: 4, cursor: 'pointer', fontSize: 15 },
  saveBtn: { background: '#28a745', color: '#fff', border: 'none', padding: '10px', borderRadius: 4, cursor: 'pointer', fontSize: 15, width: '100%' },
  qRow: { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 8px', borderBottom: '1px solid #eee', borderRadius: 4, marginBottom: 4 },
  removeBtn: { background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: 18 },
};
