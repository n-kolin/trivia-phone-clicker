import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getQuizzes, createQuiz } from '../api';

interface Quiz { id: string; name: string; description: string; status: string; }

const statusLabel: Record<string, string> = {
  draft: 'טיוטה',
  active: 'פעיל',
  ended: 'הסתיים',
};

export default function QuizzesPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { getQuizzes().then(setQuizzes); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const quiz = await createQuiz({ name, description: desc });
    setLoading(false);
    setName(''); setDesc('');
    navigate(`/quiz/${quiz.id}/edit`);
  }

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <span style={styles.logo}>🎯 טריוויה</span>
        <button onClick={() => { localStorage.removeItem('token'); navigate('/login'); }} style={styles.logoutBtn}>התנתק</button>
      </nav>

      <div style={styles.container}>
        <h2>חידונים</h2>

        <div style={styles.card}>
          <h3>צור חידון חדש</h3>
          <form onSubmit={handleCreate} style={styles.form}>
            <input
              placeholder="שם החידון"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              style={styles.input}
            />
            <input
              placeholder="תיאור (אופציונלי)"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              style={styles.input}
            />
            <button type="submit" disabled={loading} style={styles.primaryBtn}>
              {loading ? 'יוצר...' : 'צור חידון ←'}
            </button>
          </form>
        </div>

        <h3>חידונים קיימים</h3>
        {quizzes.length === 0 && <p style={{ color: '#888' }}>אין חידונים עדיין</p>}
        {quizzes.map(q => (
          <div key={q.id} style={styles.quizRow}>
            <div>
              <strong>{q.name}</strong>
              <span style={{ ...styles.badge, background: q.status === 'active' ? '#28a745' : q.status === 'ended' ? '#6c757d' : '#ffc107' }}>
                {statusLabel[q.status]}
              </span>
              {q.description && <p style={{ margin: '4px 0 0', color: '#666', fontSize: 14 }}>{q.description}</p>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {q.status === 'draft' && (
                <button onClick={() => navigate(`/quiz/${q.id}/edit`)} style={styles.secondaryBtn}>ערוך שאלות</button>
              )}
              {q.status === 'active' && (
                <button onClick={() => navigate(`/dashboard/${q.id}`)} style={styles.primaryBtn}>לוח בקרה</button>
              )}
              {q.status === 'ended' && (
                <button onClick={() => navigate(`/reports/${q.id}`)} style={styles.secondaryBtn}>דוח</button>
              )}
              <button onClick={() => navigate(`/display/${q.id}`)} style={styles.secondaryBtn}>מסך ציבורי</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f5f5f5', direction: 'rtl' },
  nav: { background: '#fff', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  logo: { fontSize: 20, fontWeight: 'bold' },
  logoutBtn: { background: 'none', border: '1px solid #ccc', padding: '6px 12px', cursor: 'pointer', borderRadius: 4 },
  container: { maxWidth: 700, margin: '32px auto', padding: '0 16px' },
  card: { background: '#fff', padding: 24, borderRadius: 8, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: { padding: '10px 12px', border: '1px solid #ddd', borderRadius: 4, fontSize: 16 },
  primaryBtn: { background: '#007bff', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 4, cursor: 'pointer', fontSize: 15 },
  secondaryBtn: { background: '#fff', color: '#007bff', border: '1px solid #007bff', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', fontSize: 14 },
  quizRow: { background: '#fff', padding: 16, borderRadius: 8, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  badge: { marginRight: 8, padding: '2px 8px', borderRadius: 12, fontSize: 12, color: '#fff' },
};
