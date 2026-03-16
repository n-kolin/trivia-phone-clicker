import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../api';

interface AnswerOption { digit: number; text: string; }
interface Question { id: string; text: string; options: AnswerOption[]; correctAnswer: number; }
interface Distribution { [digit: number]: { count: number; percentage: number }; }
interface Results {
  answeredCount: number; unansweredCount: number; distribution: Distribution;
  correctAnswer?: number; correctCount?: number; totalAnswered?: number;
}
interface LeaderboardEntry { rank: number; name: string; totalPoints: number; correctAnswers: number; }
interface Bubble { id: number; name: string; }

const COLORS = ['#e74c3c', '#3498db', '#f39c12', '#27ae60'];
const ICONS  = ['▲', '◆', '●', '■'];

type Phase = 'waiting' | 'question-in' | 'options-in' | 'playing' | 'stopped' | 'revealed' | 'leaderboard' | 'winner';

export default function DisplayPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const [phase, setPhase]               = useState<Phase>('waiting');
  const [question, setQuestion]         = useState<Question | null>(null);
  const [results, setResults]           = useState<Results | null>(null);
  const [timeLeft, setTimeLeft]         = useState<number | null>(null);
  const [totalTime, setTotalTime]       = useState(10);
  const [visibleOpts, setVisibleOpts]   = useState(0);
  const [participants, setParticipants] = useState(0);
  const [qIndex, setQIndex]             = useState(0);
  const [qTotal, setQTotal]             = useState(0);
  const [leaderboard, setLeaderboard]   = useState<LeaderboardEntry[]>([]);
  const [winner, setWinner]             = useState<LeaderboardEntry | null>(null);
  const [bubbles, setBubbles]           = useState<Bubble[]>([]);
  const [fastestName, setFastestName]   = useState<string | null>(null);
  const [fastestMs, setFastestMs]       = useState<number | null>(null);
  const bubbleId = useRef(0);
  const timers   = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const s = io(SOCKET_URL);

    s.on('quiz:participant-count', ({ count }: { count: number }) => setParticipants(count));

    s.on('quiz:question-activated', ({ question: q, questionIndex: qi, totalQuestions: tq, timerSeconds }: {
      question: Question; questionIndex: number; totalQuestions: number; timerSeconds: number;
    }) => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setQuestion(q); setResults(null); setTimeLeft(timerSeconds); setTotalTime(timerSeconds);
      setQIndex(qi); setQTotal(tq); setVisibleOpts(0); setPhase('question-in');
      setBubbles([]); setFastestName(null); setFastestMs(null);

      timers.current.push(setTimeout(() => setPhase('options-in'), 900));
      q.options.forEach((_, i) => {
        timers.current.push(setTimeout(() => {
          setVisibleOpts(i + 1);
          if (i === q.options.length - 1)
            timers.current.push(setTimeout(() => setPhase('playing'), 400));
        }, 1300 + i * 500));
      });
    });

    s.on('quiz:timer-tick', ({ secondsLeft }: { secondsLeft: number }) => setTimeLeft(secondsLeft));
    s.on('quiz:results-update', (r: Results) => setResults(r));
    s.on('quiz:question-stopped', () => setPhase('stopped'));

    s.on('quiz:participant-answered', ({ name }: { name: string }) => {
      const id = ++bubbleId.current;
      setBubbles(prev => [...prev.slice(-4), { id, name }]);
      setTimeout(() => setBubbles(prev => prev.filter(b => b.id !== id)), 2800);
    });

    s.on('quiz:answer-revealed', ({ correctAnswer, correctCount, totalAnswered, fastestName: fn, fastestMs: fm }: {
      correctAnswer: number; correctCount: number; totalAnswered: number;
      fastestName: string | null; fastestMs: number | null;
    }) => {
      setPhase('revealed'); setFastestName(fn); setFastestMs(fm);
      setResults(prev => prev
        ? { ...prev, correctAnswer, correctCount, totalAnswered }
        : { answeredCount: totalAnswered, unansweredCount: 0, distribution: {}, correctAnswer, correctCount, totalAnswered }
      );
    });

    s.on('quiz:leaderboard', ({ entries }: { entries: LeaderboardEntry[] }) => {
      setLeaderboard(entries); setPhase('leaderboard'); setQuestion(null);
    });

    s.on('quiz:ended', ({ winner: w }: { winner: LeaderboardEntry | null }) => {
      setWinner(w); setPhase('winner');
    });

    return () => { s.disconnect(); timers.current.forEach(clearTimeout); };
  }, [quizId]);

  if (phase === 'winner')      return <WinnerScreen winner={winner} />;
  if (phase === 'leaderboard') return <LeaderboardScreen entries={leaderboard} />;
  if (phase === 'waiting' || !question) return <WaitingScreen participants={participants} />;

  const pct         = timeLeft !== null ? (timeLeft / totalTime) * 100 : 0;
  const timerColor  = timeLeft !== null && timeLeft <= 3 ? '#e74c3c' : timeLeft !== null && timeLeft <= 5 ? '#f39c12' : '#2ecc71';
  const isPlaying   = phase === 'playing';
  const isRevealed  = phase === 'revealed';
  const isStopped   = phase === 'stopped' || isRevealed;
  const questionVisible = ['question-in','options-in','playing','stopped','revealed'].includes(phase);

  return (
    <div style={S.page}>

      {/* ── TOP BAR ── */}
      <div style={S.topBar}>
        <span style={S.badge}>שאלה {qIndex + 1} / {qTotal || '?'}</span>
        <span style={S.badge}>👥 {participants}</span>
      </div>

      {/* ── TIMER BAR ── */}
      <div style={S.timerTrack}>
        <div style={{
          ...S.timerFill,
          width: isPlaying ? `${pct}%` : isStopped ? '0%' : '100%',
          background: `linear-gradient(90deg, ${timerColor}cc, ${timerColor})`,
          transition: isPlaying ? 'width 0.95s linear, background 0.4s' : 'width 0.3s',
          boxShadow: isPlaying ? `0 0 18px ${timerColor}88` : 'none',
        }} />
        {isPlaying && timeLeft !== null && (
          <span style={{ ...S.timerNum, color: timerColor, textShadow: `0 0 12px ${timerColor}` }}>
            {timeLeft}
          </span>
        )}
      </div>

      {/* ── QUESTION TEXT ── */}
      <div style={{
        ...S.questionBox,
        opacity: questionVisible ? 1 : 0,
        transform: questionVisible ? 'translateY(0)' : 'translateY(-40px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}>
        <p style={S.questionText}>{question.text}</p>
      </div>

      {/* ── ANSWERER BUBBLES ── */}
      <div style={S.bubblesWrap}>
        {bubbles.map(b => (
          <div key={b.id} style={S.bubble}>⚡ {b.name} ענה!</div>
        ))}
      </div>

      {/* ── OPTIONS GRID ── */}
      <div style={{ ...S.grid, gridTemplateColumns: question.options.length === 2 ? '1fr 1fr' : '1fr 1fr' }}>
        {question.options.map((opt, i) => {
          const show     = i < visibleOpts || isPlaying || isStopped;
          const color    = COLORS[i] ?? '#555';
          const isRight  = isRevealed && opt.digit === results?.correctAnswer;
          const isWrong  = isRevealed && opt.digit !== results?.correctAnswer;
          const dist     = results?.distribution[opt.digit];
          const optPct   = dist?.percentage ?? 0;
          const optCount = dist?.count ?? 0;

          return (
            <div key={opt.digit} style={{
              ...S.option,
              background: isRight ? 'linear-gradient(135deg,#27ae60,#2ecc71)' : isWrong ? '#111' : `linear-gradient(135deg,${color}dd,${color})`,
              opacity: show ? (isWrong ? 0.35 : 1) : 0,
              transform: show ? 'scale(1) translateY(0)' : 'scale(0.85) translateY(20px)',
              border: isRight ? '3px solid #2ecc71' : '3px solid transparent',
              boxShadow: isRight ? '0 0 30px #2ecc7166' : show ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
              transition: `opacity 0.4s ${i * 0.08}s, transform 0.4s ${i * 0.08}s cubic-bezier(0.34,1.56,0.64,1), background 0.4s, opacity 0.4s`,
            }}>
              {/* Option header */}
              <div style={S.optHeader}>
                <span style={S.optIcon}>{ICONS[i]}</span>
                <span style={S.optHint}>לחץ {opt.digit}</span>
              </div>

              {/* Option text */}
              <p style={S.optText}>{opt.text}</p>

              {/* Stats bar (after stop) */}
              {isStopped && (
                <div style={S.statsWrap}>
                  <div style={S.barTrack}>
                    <div style={{
                      ...S.barFill,
                      width: `${optPct}%`,
                      background: isRight ? '#2ecc71' : 'rgba(255,255,255,0.45)',
                      transition: 'width 0.9s ease 0.2s',
                    }} />
                  </div>
                  <span style={S.statLabel}>{optCount} ({optPct.toFixed(0)}%)</span>
                </div>
              )}

              {/* Correct badge */}
              {isRight && <div style={S.correctBadge}>✓ נכון!</div>}
            </div>
          );
        })}
      </div>

      {/* ── FOOTER ── */}
      {isStopped && (
        <div style={S.footer}>
          {isRevealed ? (
            <>
              {fastestName && (
                <span style={S.fastest}>
                  🏆 הכי מהיר: {fastestName} — {fastestMs !== null ? (fastestMs / 1000).toFixed(1) : '?'} שניות
                </span>
              )}
              <span style={S.footerStat}>
                ✅ ענו נכון: {results?.correctCount ?? 0} &nbsp;|&nbsp; סה"כ ענו: {results?.answeredCount ?? 0}
              </span>
            </>
          ) : (
            <span style={S.footerStat}>
              ענו: {results?.answeredCount ?? 0} &nbsp;|&nbsp; ממתינים: {results?.unansweredCount ?? 0}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── SUB-SCREENS ─── */

function WaitingScreen({ participants }: { participants: number }) {
  return (
    <div style={{ ...S.page, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ fontSize: 100, marginBottom: 24, animation: 'pulse 2s infinite' }}>🎯</div>
      <h1 style={{ fontSize: 56, margin: 0, color: '#fff', fontWeight: 900 }}>ממתינים לשאלה...</h1>
      <p style={{ fontSize: 30, color: '#888', marginTop: 20 }}>👥 {participants} משתתפים מחוברים</p>
    </div>
  );
}

function LeaderboardScreen({ entries }: { entries: LeaderboardEntry[] }) {
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <div style={{ ...S.page, alignItems: 'center', paddingTop: 40 }}>
      <h1 style={{ fontSize: 60, color: '#f1c40f', marginBottom: 32, textShadow: '0 0 30px #f1c40f66' }}>
        🏆 לוח המובילים
      </h1>
      <div style={{ width: '100%', maxWidth: 760 }}>
        {entries.slice(0, 10).map((e, i) => (
          <div key={e.rank} style={{
            display: 'flex', alignItems: 'center', gap: 20,
            padding: '18px 28px', borderRadius: 16, marginBottom: 12,
            background: i === 0 ? 'linear-gradient(135deg,#b8860b,#f1c40f33)'
                      : i === 1 ? 'linear-gradient(135deg,#607080,#90a0b033)'
                      : i === 2 ? 'linear-gradient(135deg,#7b4a2a,#cd7f3233)'
                      : '#1a2535',
            fontSize: 28, border: i < 3 ? '1px solid rgba(255,255,255,0.15)' : 'none',
            animation: `slideIn 0.4s ${i * 0.07}s both`,
          }}>
            <span style={{ fontSize: 40, width: 56, textAlign: 'center' }}>{medals[i] ?? `${i + 1}.`}</span>
            <span style={{ flex: 1, fontWeight: 'bold' }}>{e.name}</span>
            <span style={{ color: '#f1c40f', fontWeight: 'bold', minWidth: 100, textAlign: 'left' }}>{e.totalPoints} נק'</span>
            <span style={{ color: '#2ecc71', minWidth: 60, textAlign: 'left' }}>{e.correctAnswers}✓</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WinnerScreen({ winner }: { winner: LeaderboardEntry | null }) {
  return (
    <div style={{ ...S.page, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ fontSize: 160, animation: 'pulse 1.5s infinite' }}>🏆</div>
      <h1 style={{ fontSize: 56, color: '#f1c40f', margin: '8px 0', textShadow: '0 0 40px #f1c40f' }}>
        המנצח הוא...
      </h1>
      {winner ? (
        <>
          <h2 style={{ fontSize: 88, fontWeight: 900, color: '#fff', margin: '12px 0 8px', textShadow: '0 0 20px rgba(255,255,255,0.3)' }}>
            {winner.name}
          </h2>
          <p style={{ fontSize: 44, color: '#f1c40f', margin: 0 }}>{winner.totalPoints} נקודות</p>
          <p style={{ fontSize: 30, color: '#2ecc71', marginTop: 10 }}>{winner.correctAnswers} תשובות נכונות</p>
        </>
      ) : (
        <h2 style={{ fontSize: 60, color: '#fff' }}>החידון הסתיים!</h2>
      )}
      <p style={{ color: '#888', marginTop: 48, fontSize: 32 }}>תודה על השתתפותכם 🎉</p>
    </div>
  );
}

/* ─── STYLES ─── */
const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', width: '100vw',
    background: 'linear-gradient(160deg, #0a0a18 0%, #0d1525 60%, #0a1020 100%)',
    color: '#fff', display: 'flex', flexDirection: 'column',
    padding: '16px 28px 12px', direction: 'rtl',
    fontFamily: '"Segoe UI", "Arial Hebrew", Arial, sans-serif',
    boxSizing: 'border-box', overflow: 'hidden',
  },
  topBar: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  badge: {
    fontSize: 20, color: '#aaa',
    background: 'rgba(255,255,255,0.06)',
    padding: '4px 14px', borderRadius: 20,
  },
  timerTrack: {
    width: '100%', height: 22, background: '#1a1a2e',
    borderRadius: 11, marginBottom: 18,
    position: 'relative', overflow: 'hidden',
    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.5)',
  },
  timerFill: { height: '100%', borderRadius: 11 },
  timerNum: {
    position: 'absolute', left: '50%', top: '50%',
    transform: 'translate(-50%,-50%)',
    fontSize: 14, fontWeight: 'bold',
  },
  questionBox: {
    background: 'rgba(22,33,62,0.85)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20, padding: '22px 40px',
    marginBottom: 18, textAlign: 'center',
    backdropFilter: 'blur(4px)',
  },
  questionText: {
    fontSize: 40, fontWeight: 'bold', margin: 0,
    lineHeight: 1.35, color: '#fff',
  },
  bubblesWrap: {
    position: 'fixed', bottom: 90, left: 28,
    display: 'flex', flexDirection: 'column-reverse',
    gap: 8, zIndex: 200, pointerEvents: 'none',
  },
  bubble: {
    background: 'linear-gradient(135deg,#27ae60,#2ecc71)',
    color: '#fff', padding: '9px 20px',
    borderRadius: 28, fontSize: 22, fontWeight: 'bold',
    boxShadow: '0 4px 16px rgba(46,204,113,0.5)',
    animation: 'floatUp 2.8s ease-out forwards',
    whiteSpace: 'nowrap',
  },
  grid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: 14, flex: 1,
  },
  option: {
    borderRadius: 20, padding: '18px 22px',
    position: 'relative', display: 'flex',
    flexDirection: 'column', minHeight: 120,
    cursor: 'default',
  },
  optHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  optIcon: {
    width: 42, height: 42, borderRadius: '50%',
    background: 'rgba(0,0,0,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20, fontWeight: 'bold',
    flexShrink: 0,
  },
  optHint: { fontSize: 17, opacity: 0.7 },
  optText: {
    fontSize: 28, fontWeight: 'bold', margin: 0,
    flex: 1, display: 'flex', alignItems: 'center',
    lineHeight: 1.3, wordBreak: 'break-word',
  },
  statsWrap: { marginTop: 10 },
  barTrack: {
    height: 10, background: 'rgba(0,0,0,0.35)',
    borderRadius: 5, marginBottom: 5, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 5 },
  statLabel: { fontSize: 19, fontWeight: 'bold', opacity: 0.9 },
  correctBadge: {
    position: 'absolute', top: 14, left: 14,
    background: '#2ecc71', color: '#fff',
    padding: '5px 16px', borderRadius: 20,
    fontSize: 19, fontWeight: 'bold',
    boxShadow: '0 2px 10px rgba(46,204,113,0.6)',
  },
  footer: {
    display: 'flex', justifyContent: 'center',
    alignItems: 'center', gap: 36,
    marginTop: 14, flexWrap: 'wrap',
    padding: '10px 0',
  },
  fastest: {
    fontSize: 26, color: '#f1c40f', fontWeight: 'bold',
    textShadow: '0 0 12px #f1c40f88',
  },
  footerStat: { fontSize: 24, color: '#bbb' },
};
