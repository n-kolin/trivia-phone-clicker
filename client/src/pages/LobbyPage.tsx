import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { startQuiz } from '../api';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';
function authHeaders() {
  const token = localStorage.getItem('token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export default function LobbyPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [quizName, setQuizName] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const phoneNumber = process.env.REACT_APP_PHONE_NUMBER || '📞 הגדר REACT_APP_PHONE_NUMBER';

  useEffect(() => {
    fetch(`${BASE}/api/quizzes/${quizId}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(q => setQuizName(q.name || 'חידון'))
      .catch(() => setError('שגיאה בטעינת החידון'));
  }, [quizId]);

  async function handleStart() {
    setStarting(true);
    setError('');
    try {
      await startQuiz(quizId!);
      navigate(`/dashboard/${quizId}`);
    } catch (e) {
      setError('שגיאה בהתחלת החידון');
      setStarting(false);
    }
  }

  return (
    <div style={s.page}>
      {/* Admin controls - top right */}
      <div style={s.adminBar}>
        <button onClick={() => navigate(`/quiz/${quizId}/edit`)} style={s.backBtn}>← חזור לעריכה</button>
        <button onClick={handleStart} disabled={starting} style={s.startBtnSmall}>
          {starting ? 'מתחיל...' : '▶ התחל עכשיו'}
        </button>
      </div>

      {/* Main display - for projector/screen */}
      <div style={s.center}>
        <div style={s.logo}>🎯</div>
        <h1 style={s.quizName}>{quizName || '...'}</h1>
        <p style={s.subtitle}>מוכנים לשחק?</p>

        <div style={s.phoneBox}>
          <p style={s.phoneLabel}>חייגו למספר:</p>
          <div style={s.phoneNumber}>{phoneNumber}</div>
          <p style={s.phoneHint}>לחצו 1-4 כדי לענות על השאלות</p>
        </div>

        <div style={s.waitingRow}>
          <span style={s.dot} />
          <span style={s.waitingText}>ממתין למשתתפים...</span>
        </div>

        {error && <p style={{ color: '#ff6b6b', marginTop: 16 }}>{error}</p>}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    direction: 'rtl',
    position: 'relative',
  },
  adminBar: {
    position: 'absolute',
    top: 16,
    right: 16,
    display: 'flex',
    gap: 12,
    zIndex: 10,
  },
  backBtn: {
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#fff',
    padding: '10px 20px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 15,
  },
  startBtnSmall: {
    background: 'linear-gradient(135deg, #28a745, #20c997)',
    border: 'none',
    color: '#fff',
    padding: '10px 28px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: 'bold',
    boxShadow: '0 4px 15px rgba(40,167,69,0.4)',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: 32,
    textAlign: 'center',
    color: '#fff',
  },
  logo: { fontSize: 80, marginBottom: 16 },
  quizName: { fontSize: 42, fontWeight: 'bold', margin: '0 0 8px', color: '#fff' },
  subtitle: { fontSize: 22, color: 'rgba(255,255,255,0.7)', margin: '0 0 48px' },
  phoneBox: {
    background: 'rgba(255,255,255,0.08)',
    border: '2px solid rgba(255,215,0,0.4)',
    borderRadius: 20,
    padding: '32px 64px',
    marginBottom: 40,
  },
  phoneLabel: { margin: '0 0 8px', fontSize: 18, color: 'rgba(255,255,255,0.7)' },
  phoneNumber: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#ffd700',
    letterSpacing: 6,
    direction: 'ltr',
    margin: '0 0 12px',
  },
  phoneHint: { margin: 0, fontSize: 16, color: 'rgba(255,255,255,0.5)' },
  waitingRow: { display: 'flex', alignItems: 'center', gap: 10 },
  dot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: '#4ade80',
    boxShadow: '0 0 8px #4ade80',
    animation: 'pulse 1.5s infinite',
  },
  waitingText: { fontSize: 18, color: 'rgba(255,255,255,0.6)' },
};
