import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import QuestionsPage from './pages/QuestionsPage';
import QuizzesPage from './pages/QuizzesPage';
import DashboardPage from './pages/DashboardPage';
import ReportsPage from './pages/ReportsPage';
import DisplayPage from './pages/DisplayPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  return localStorage.getItem('token') ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/display/:quizId" element={<DisplayPage />} />
        <Route path="/questions" element={<PrivateRoute><QuestionsPage /></PrivateRoute>} />
        <Route path="/quizzes" element={<PrivateRoute><QuizzesPage /></PrivateRoute>} />
        <Route path="/dashboard/:quizId" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/reports/:quizId" element={<PrivateRoute><ReportsPage /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/quizzes" />} />
      </Routes>
    </BrowserRouter>
  );
}
