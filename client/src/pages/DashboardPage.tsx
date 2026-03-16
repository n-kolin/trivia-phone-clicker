import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { endQuiz, SOCKET_URL } from '../api';

interface LeaderboardEntry { rank: number; name: string; totalPoints: number; correctAnswers: number; }

export default function DashboardPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [participants, setParticipants] = useState(0);
  const [qIndex, setQIndex] = useState(0);
  const [qTotal, setQTotal] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [currentQ, setCurrentQ] = useState('');
  const [phase, setPhase] = useState<'waiting' | 'active' | 'revealed'>('waiting');

  useEffect(() => {
    const s = io(SOCKET_URL);
    s.on('quiz:participant-count', ({ count }: { count: number }) => setParticipants(count));
    s.on('quiz:question-activated', ({ question, questionIndex: qi, totalQuestions: tq, timerSeconds }: {
      question: { text: string }; questionIndex: number; totalQuestions: number; timerSeconds: number;
    }) => {
      setCurrentQ(question.text);
      setQIndex(qi);
      setQTotal(tq);
      setTimeLeft(timerSeconds);
      setAnsweredCount(0);
      setPhase('active');
    });
    s.on('quiz:timer-tick', ({ secondsLeft }: { secondsLeft: number }) => setTimeLeft(secondsLeft));
    s.on('quiz:results-update', (r: { answeredCount: number }) => setAnsweredCount(r.answeredCount));
    s.on('quiz:answer-revealed', () => setPhase('revealed'));
    s.on('quiz:leaderboard', ({ entries }: { entries: LeaderboardEntry[] }) => setLeaderboard(entries));
    s.on('quiz:ended', () => navigate(`/reports/${quizId}`));
    return () => { s.disconnect(); };
  }, [quizId, navigate]);

  async function handleEnd() {
    if (window.confirm('לסיים את החידון?')) await endQuiz(quizId!);
  }

  const timerColor = timeLeft !== null && timeLeft <= 3 ? '#e74c3c'
    : timeLeft !== null && timeLeft <= 5 ? '#f39c12' : '#2ecc71';

  return (
    <div style={S.page}>
      {/* Nav */}
      <nav style={S.nav}>
        <span style={S.navTitle}>🎮 שליטה בחידון</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => window.open(`/display/${quizId}`, '_blank')} style={S.displayBtn}>
            📺 מסך ציבורי
          </button>
          <button onClick={handleEnd} style={S.endBtn}>⏹ סיים חידון</button>
        </div>
      </nav>

      <div style={S.body}>
        {/* Stats row */}
        <div style={S.statsRow}>
          <div style={S.statBox}>
            <span style={S.statNum}>{participants}</span>
            <span style={S.statLbl}>משתתפים</span>
          </div>
          <div style={S.statBox}>
            <span style={S.statNum}>{qTotal > 0 ? `${qIndex + 1} / ${qTotal}` : '—'}</span>
            <span style={S.statLbl}>שאלה</span>
          </div>
          <div style={S.statBox}>
            <span style={{ ...S.statNum, color: phase === 'active' ? timerColor : '#888' }}>
              {phase === 'active' && timeLeft !== null ? `${timeLeft}s` : '—'}
            </span>
            <span style={S.statLbl}>זמן</span>
          </div>
          <div style={S.statBox}>
            <span style={S.statNum}>{answeredCount}</span>
            <span style={S.statLbl}>ענו</span>
          </div>
        </div>

        {/* Current question */}
        <div style={S.qCard}>
          {phase === 'waiting' && (
            <p style={S.waitText}>⏳ ממתין לשאלה הראשונה...</p>
          )}
          {phase === 'active' && (
            <>
              <p style={S.qLabel}>שאלה פעילה</p>
              <p style={S.qText}>{currentQ}</p>
              {timeLeft !== null && (
                <div style={S.timerBar}>
                  <div style={{ ...S.timerFill, background: timerColor, width: `${(timeLeft / 10) * 100}%` }} />
                </div>
              )}
            </>
          )}
          {phase === 'revealed' && (
            <p style={S.revealedText}>✅ תשובה נחשפה — עובר לשאלה הבאה...</p>
          )}
        </div>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div style={S.lbCard}>
            <h3 style={S.lbTitle}>🏆 מובילים</h3>
            {leaderboard.slice(0, 5).map((e, i) => (
              <div key={e.rank} style={S.lbRow}>
                <span style={S.lbRank}>{['🥇','🥈','🥉'][i] ?? `${i+1}.`}</span>
                <span style={S.lbName}>{e.name}</span>
                <span style={S.lbPts}>{e.totalPoints} נק'</span>
                <span style={S.lbCorrect}>{e.correctAnswers}✓</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0f1923', color: '#fff', direction: 'rtl', fontFamily: '"Segoe UI", Arial, sans-serif' },
  nav: { background: '#1a2535', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2a3a50' },
  navTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  displayBtn: { background: '#6f42c1', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 15 },
  endBtn: { background: '#c0392b', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 15 },
  body: { maxWidth: 700, margin: '32px auto', padding: '0 20px' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 },
  statBox: { background: '#1a2535', borderRadius: 12, padding: '16px 12px', textAlign: 'center', border: '1px solid #2a3a50' },
  statNum: { display: 'block', fontSize: 32, fontWeight: 'bold', color: '#3498db' },
  statLbl: { display: 'block', fontSize: 13, color: '#888', marginTop: 4 },
  qCard: { background: '#1a2535', borderRadius: 16, padding: '28px 32px', marginBottom: 24, border: '1px solid #2a3a50', minHeight: 120 },
  waitText: { fontSize: 22, color: '#888', textAlign: 'center', margin: 0 },
  qLabel: { fontSize: 13, color: '#3498db', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 1 },
  qText: { fontSize: 24, fontWeight: 'bold', margin: '0 0 16px', lineHeight: 1.4 },
  timerBar: { height: 8, background: '#0f1923', borderRadius: 4, overflow: 'hidden' },
  timerFill: { height: '100%', borderRadius: 4, transition: 'width 0.9s linear, background 0.3s' },
  revealedText: { fontSize: 20, color: '#2ecc71', textAlign: 'center', margin: 0 },
  lbCard: { background: '#1a2535', borderRadius: 16, padding: '20px 24px', border: '1px solid #2a3a50' },
  lbTitle: { margin: '0 0 16px', fontSize: 18, color: '#f1c40f' },
  lbRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #2a3a50' },
  lbRank: { fontSize: 22, width: 36 },
  lbName: { flex: 1, fontSize: 16, fontWeight: 'bold' },
  lbPts: { color: '#f1c40f', fontWeight: 'bold', fontSize: 15 },
  lbCorrect: { color: '#2ecc71', fontSize: 14, minWidth: 40, textAlign: 'left' },
};
