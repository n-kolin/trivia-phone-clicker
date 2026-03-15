import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { token } = await login(username, password);
      localStorage.setItem('token', token);
      navigate('/quizzes');
    } catch {
      setError('שם משתמש או סיסמה שגויים');
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', padding: 24 }}>
      <h2>כניסה למערכת</h2>
      <form onSubmit={handleSubmit}>
        <div><input placeholder="שם משתמש" value={username} onChange={e => setUsername(e.target.value)} required /></div>
        <div><input type="password" placeholder="סיסמה" value={password} onChange={e => setPassword(e.target.value)} required /></div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit">כניסה</button>
      </form>
    </div>
  );
}
