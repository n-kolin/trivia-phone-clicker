import React, { useEffect, useState } from 'react';
import { getQuestions, createQuestion, deleteQuestion } from '../api';

interface AnswerOption { digit: number; text: string; }
interface Question { id: string; text: string; options: AnswerOption[]; correctAnswer: number; }

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [text, setText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correct, setCorrect] = useState(1);
  const [optCount, setOptCount] = useState(4);
  const [error, setError] = useState('');

  useEffect(() => { getQuestions().then(setQuestions); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const opts = options.slice(0, optCount).map((t, i) => ({ digit: i + 1, text: t }));
      await createQuestion({ text, options: opts, correctAnswer: correct });
      setText(''); setOptions(['', '', '', '']);
      getQuestions().then(setQuestions);
    } catch { setError('שגיאה ביצירת שאלה'); }
  }

  async function handleDelete(id: string) {
    try { await deleteQuestion(id); getQuestions().then(setQuestions); }
    catch { setError('לא ניתן למחוק שאלה בחידון פעיל'); }
  }

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: 24, direction: 'rtl' }}>
      <h2>ניהול שאלות</h2>
      <form onSubmit={handleCreate} style={{ marginBottom: 32 }}>
        <div><input placeholder="נוסח השאלה" value={text} onChange={e => setText(e.target.value)} required style={{ width: '100%' }} /></div>
        <div>
          <label>מספר אפשרויות: </label>
          <select value={optCount} onChange={e => setOptCount(Number(e.target.value))}>
            {[2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        {options.slice(0, optCount).map((opt, i) => (
          <div key={i}>
            <input placeholder={`אפשרות ${i + 1}`} value={opt}
              onChange={e => { const o = [...options]; o[i] = e.target.value; setOptions(o); }} required />
          </div>
        ))}
        <div>
          <label>תשובה נכונה: </label>
          <select value={correct} onChange={e => setCorrect(Number(e.target.value))}>
            {Array.from({ length: optCount }, (_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
          </select>
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit">הוסף שאלה</button>
      </form>

      <h3>שאלות קיימות</h3>
      {questions.map(q => (
        <div key={q.id} style={{ border: '1px solid #ccc', padding: 12, marginBottom: 8 }}>
          <strong>{q.text}</strong>
          <ul>{q.options.map(o => <li key={o.digit} style={{ fontWeight: o.digit === q.correctAnswer ? 'bold' : 'normal' }}>{o.digit}. {o.text}</li>)}</ul>
          <button onClick={() => handleDelete(q.id)}>מחק</button>
        </div>
      ))}
    </div>
  );
}
