import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../api';

interface AnswerOption { digit: number; text: string; }
interface Question { id: string; text: string; options: AnswerOption[]; correctAnswer: number; }
interface Distribution { [digit: number]: { count: number; percentage: number }; }
interface Results { answeredCount: number; unansweredCount: number; distribution: Distribution; correctAnswer?: number; }

export default function DisplayPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const [question, setQuestion] = useState<Question | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [ended, setEnded] = useState(false);
  const [participants, setParticipants] = useState(0);

  useEffect(() => {
    const s = io(SOCKET_URL);
    s.on('quiz:participant-count', ({ count }: { count: number }) => setParticipants(count));
    s.on('quiz:question-activated', ({ question: q }: { question: Question }) => {
      setQuestion(q); setResults(null); setRevealed(false); setStopped(false);
    });
    s.on('quiz:results-update', (r: Results) => setResults(r));
    s.on('quiz:question-stopped', () => setStopped(true));
    s.on('quiz:answer-revealed', ({ correctAnswer }: { correctAnswer: number }) => {
      setRevealed(true);
      setResults(prev => prev ? { ...prev, correctAnswer } : prev);
    });
    s.on('quiz:ended', () => setEnded(true));
    return () => { s.disconnect(); };
  }, [quizId]);

  const styles = {
    container: { minHeight: '100vh', background: '#1a1a2e', color: 'white', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: 40, direction: 'rtl' as const },
    question: { fontSize: 48, fontWeight: 'bold', textAlign: 'center' as const, marginBottom: 48 },
    optionsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, width: '100%', maxWidth: 900 },
    option: (digit: number, isCorrect: boolean, isRevealed: boolean) => ({
      background: isRevealed ? (isCorrect ? '#27ae60' : '#c0392b') : '#16213e',
      border: `3px solid ${isRevealed ? (isCorrect ? '#2ecc71' : '#e74c3c') : '#0f3460'}`,
      borderRadius: 16, padding: 32, fontSize: 28, cursor: 'default',
      transition: 'all 0.5s',
    }),
    digitBadge: { fontSize: 36, fontWeight: 'bold', marginBottom: 8, display: 'block' },
    bar: (pct: number, isCorrect: boolean, isRevealed: boolean) => ({
      height: 8, background: isRevealed ? (isCorrect ? '#2ecc71' : '#e74c3c') : '#0f3460',
      width: `${pct}%`, borderRadius: 4, marginTop: 8, transition: 'width 0.5s',
    }),
    footer: { marginTop: 40, fontSize: 20, opacity: 0.7 },
  };

  if (ended) return <div style={styles.container}><h1 style={{ fontSize: 64 }}>החידון הסתיים!</h1><p style={styles.footer}>תודה על השתתפותכם</p></div>;

  if (!question) return (
    <div style={styles.container}>
      <h1 style={{ fontSize: 48 }}>ממתינים לשאלה...</h1>
      <p style={styles.footer}>משתתפים מחוברים: {participants}</p>
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.question}>{question.text}</div>
      <div style={styles.optionsGrid}>
        {question.options.map(opt => {
          const isCorrect = opt.digit === results?.correctAnswer;
          const dist = results?.distribution[opt.digit];
          const pct = dist?.percentage ?? 0;
          const count = dist?.count ?? 0;
          return (
            <div key={opt.digit} style={styles.option(opt.digit, isCorrect, revealed)}>
              <span style={styles.digitBadge}>לחץ {opt.digit}</span>
              {opt.text}
              {(stopped || revealed) && (
                <>
                  <div style={styles.bar(pct, isCorrect, revealed)} />
                  <div style={{ fontSize: 18, marginTop: 4 }}>{count} ({pct.toFixed(1)}%)</div>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div style={styles.footer}>
        {results ? `ענו: ${results.answeredCount} | לא ענו: ${results.unansweredCount}` : `משתתפים: ${participants}`}
      </div>
    </div>
  );
}
