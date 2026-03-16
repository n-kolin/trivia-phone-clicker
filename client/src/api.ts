const BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function authHeaders() {
  const token = localStorage.getItem('token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export async function login(username: string, password: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw await res.json();
  return res.json();
}

export async function getQuizzes() {
  const res = await fetch(`${BASE}/api/quizzes`, { headers: authHeaders() });
  return res.json();
}

export async function createQuiz(data: { name: string; description?: string }) {
  const res = await fetch(`${BASE}/api/quizzes`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) });
  return res.json();
}

export async function getQuestions() {
  const res = await fetch(`${BASE}/api/questions`, { headers: authHeaders() });
  return res.json();
}

export async function createQuestion(data: object) {
  const res = await fetch(`${BASE}/api/questions`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) });
  return res.json();
}

export async function deleteQuestion(id: string) {
  await fetch(`${BASE}/api/questions/${id}`, { method: 'DELETE', headers: authHeaders() });
}

export async function activateQuestion(quizId: string, qid: string) {
  await fetch(`${BASE}/api/quizzes/${quizId}/questions/${qid}/activate`, { method: 'POST', headers: authHeaders() });
}

export async function stopQuestion(quizId: string, qid: string) {
  await fetch(`${BASE}/api/quizzes/${quizId}/questions/${qid}/stop`, { method: 'POST', headers: authHeaders() });
}

export async function revealAnswer(quizId: string, qid: string) {
  await fetch(`${BASE}/api/quizzes/${quizId}/questions/${qid}/reveal`, { method: 'POST', headers: authHeaders() });
}

export async function startQuiz(quizId: string) {
  await fetch(`${BASE}/api/quizzes/${quizId}/start`, { method: 'POST', headers: authHeaders() });
}

export async function endQuiz(quizId: string) {
  await fetch(`${BASE}/api/quizzes/${quizId}/end`, { method: 'POST', headers: authHeaders() });
}

export async function getReport(quizId: string) {
  const res = await fetch(`${BASE}/api/reports/${quizId}`, { headers: authHeaders() });
  return res.json();
}

export async function getParticipants(quizId: string) {
  const res = await fetch(`${BASE}/api/quizzes/${quizId}/participants`, { headers: authHeaders() });
  return res.json();
}

export async function addParticipant(quizId: string, data: { name: string; phone: string }) {
  const res = await fetch(`${BASE}/api/quizzes/${quizId}/participants`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data)
  });
  return res.json();
}

export async function deleteParticipant(quizId: string, pid: string) {
  await fetch(`${BASE}/api/quizzes/${quizId}/participants/${pid}`, { method: 'DELETE', headers: authHeaders() });
}

export async function getLeaderboard(quizId: string) {
  const res = await fetch(`${BASE}/api/quizzes/${quizId}/leaderboard`, { headers: authHeaders() });
  return res.json();
}

export const SOCKET_URL = BASE;
