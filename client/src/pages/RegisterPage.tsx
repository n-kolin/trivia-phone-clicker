import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

interface Quiz { id: string; name: string; description: string; status: string; }

export default function RegisterPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${BASE}/api/quizzes/${quizId}/public`)
      .then(r => r.ok ? r.json() : null)
      .then(q => setQuiz(q))
      .catch(() => {});
  }, [quizId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BASE}/api/quizzes/${quizId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'שגיאה בהרשמה');
      }
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בהרשמה');
    }
    setLoading(false);
  }

  if (success) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.successIcon}>✅</div>
          <h2 style={s.successTitle}>נרשמת בהצלחה!</h2>
          <p style={s.successText}>שלום <strong>{name}</strong>, אתה רשום לחידון.</p>
          <p style={s.successHint}>כשהחידון יתחיל תקבל הנחיות על המסך הגדול.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>🎯</div>
        <h1 style={s.title}>{quiz?.name || 'חידון טריוויה'}</h1>
        {quiz?.description && <p style={s.desc}>{quiz.description}</p>}
        <h2 style={s.subtitle}>הרשמה למשחק</h2>

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>שם מלא</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="הכנס את שמך"
              required
              style={s.input}
              autoComplete="name"
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>מספר טלפון</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="050-0000000"
              required
              style={s.input}
              autoComplete="tel"
              dir="ltr"
            />
          </div>
          {error && <p style={s.error}>{error}</p>}
          <button type="submit" disabled={loading} style={s.btn}>
            {loading ? 'נרשם...' : 'הירשם למשחק 🎮'}
          </button>
        </form>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, direction: 'rtl', fontFamily: 'Arial, sans-serif' },
  card: { background: '#fff', borderRadius: 20, padding: '40px 32px', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' },
  logo: { fontSize: 64, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 8px' },
  desc: { color: '#666', fontSize: 15, margin: '0 0 16px' },
  subtitle: { fontSize: 20, color: '#333', margin: '0 0 24px', borderTop: '1px solid #eee', paddingTop: 16 },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  field: { textAlign: 'right' },
  label: { display: 'block', fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 6 },
  input: { width: '100%', padding: '12px 16px', border: '2px solid #ddd', borderRadius: 10, fontSize: 16, boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s' },
  error: { color: '#e74c3c', fontSize: 14, margin: 0 },
  btn: { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'none', padding: '14px', borderRadius: 10, fontSize: 18, fontWeight: 'bold', cursor: 'pointer', marginTop: 8 },
  successIcon: { fontSize: 72, marginBottom: 16 },
  successTitle: { fontSize: 28, color: '#27ae60', margin: '0 0 12px' },
  successText: { fontSize: 18, color: '#333', margin: '0 0 8px' },
  successHint: { fontSize: 15, color: '#666', margin: 0 },
};
