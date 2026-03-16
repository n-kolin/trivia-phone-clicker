import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from './config';
import webhookHandler from './routes/webhookHandler';
import authRoutes from './routes/authRoutes';
import questionRoutes from './routes/questionRoutes';
import quizRoutes from './routes/quizRoutes';
import reportRoutes from './routes/reportRoutes';
import * as quizManager from './services/quizManager';
import participantRoutes from './routes/participantRoutes';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

quizManager.initialize(io);

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ניסיוני - בדיקת חיבור ימות המשיח
const yemotLog: { time: string; phone: string; digit: string }[] = [];

app.get('/api/yemot-test', (req, res) => {
  res.set('Content-Type', 'text/plain; charset=utf-8');
  const phone = (req.query.ApiPhone as string) || 'unknown';
  const digit = (req.query.val_1 as string) ?? '';

  if (digit === '') {
    // כניסה ראשונה או timeout - בקש ספרה
    console.log(`[yemot-test] שיחה נכנסת מ-${phone}`);
    return res.send('read=t-ברוכים הבאים לבדיקה. הקישו ספרה כלשהי=val_1,no,1,1,15,No,No');
  }

  // ספרה נקלטה
  yemotLog.push({ time: new Date().toISOString(), phone, digit });
  console.log(`[yemot-test] נקלט מ-${phone}: ${digit}`);
  return res.send(`id_list_message=t-קלטתי את הספרה ${digit}. תודה&go_to_folder=hangup`);
});

// צפייה בלוג הניסיוני
app.get('/api/yemot-test/log', (_req, res) => {
  res.json(yemotLog);
});

app.use('/webhook', webhookHandler);
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/quizzes', participantRoutes);
app.use('/api/reports', reportRoutes);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

httpServer.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

export { app, io };
