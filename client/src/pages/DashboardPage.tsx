import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { activateQuestion, stopQuestion, revealAnswer, endQuiz, SOCKET_URL } from '../api';

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

  useEffect(() => {
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
    <div style={{ maxWidth: 800, margin: '40px auto', padding: 24, direction: 'rtl' }}>
      <h2>לוח בקרה</h2>
      <p>משתתפים מחוברים: <strong>{participants}</strong></p>

      {activeQuestion && (
        <div style={{ border: '2px solid #007bff', padding: 16, marginBottom: 16 }}>
          <h3>שאלה פעילה: {activeQuestion.text}</h3>
          <ul>
            {activeQuestion.options.map(o => (
              <li key={o.digit} style={{ fontWeight: revealed && o.digit === activeQuestion.correctAnswer ? 'bold' : 'normal', color: revealed && o.digit === activeQuestion.correctAnswer ? 'green' : 'inherit' }}>
                {o.digit}. {o.text}
                {results?.distribution[o.digit] && ` — ${results.distribution[o.digit].count} (${results.distribution[o.digit].percentage.toFixed(1)}%)`}
              </li>
            ))}
          </ul>
          {results && <p>ענו: {results.answeredCount} | לא ענו: {results.unansweredCount}</p>}
          <button onClick={handleStop}>עצור שאלה</button>
          <button onClick={handleReveal} disabled={revealed}>חשוף תשובה</button>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <button onClick={handleEnd} style={{ background: 'red', color: 'white' }}>סיים חידון</button>
      </div>
    </div>
  );
}
