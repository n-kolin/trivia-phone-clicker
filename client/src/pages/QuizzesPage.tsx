import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getQuizzes, createQuiz, startQuiz } from '../api';

interface Quiz { id: string; name: string; description: string; status: string; }

export default function QuizzesPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const navigate = useNavigate();

  useEffect(() => { getQuizzes().then(setQuizzes); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await createQuiz({ name, description: desc });
    setName(''); setDesc('');
    getQuizzes().then(setQuizzes);
  }

  async function handleStart(id: string) {
    await startQuiz(id);
    navigate(`/dashboard/${id}`);
  }

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: 24, direction: 'rtl' }}>
      <h2>ניהול חידונים</h2>
      <form onSubmit={handleCreate} style={{ marginBottom: 32 }}>
        <input placeholder="שם החידון" value={name} onChange={e => setName(e.target.value)} required />
        <input placeholder="תיאור (אופציונלי)" value={desc} onChange={e => setDesc(e.target.value)} />
        <button type="submit">צור חידון</button>
      </form>
      <h3>חידונים קיימים</h3>
      {quizzes.map(q => (
        <div key={q.id} style={{ border: '1px solid #ccc', padding: 12, marginBottom: 8 }}>
          <strong>{q.name}</strong> — {q.status}
          <div>
            {q.status === 'draft' && <button onClick={() => handleStart(q.id)}>התחל חידון</button>}
            {q.status === 'active' && <button onClick={() => navigate(`/dashboard/${q.id}`)}>לוח בקרה</button>}
            {q.status === 'ended' && <button onClick={() => navigate(`/reports/${q.id}`)}>דוח</button>}
            <button onClick={() => navigate(`/display/${q.id}`)}>מסך ציבורי</button>
          </div>
        </div>
      ))}
    </div>
  );
}
