import { Router, Request, Response } from 'express';
import { query } from '../db/db';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();
router.use(authMiddleware);

// GET /api/quizzes/:quizId/participants
router.get('/:quizId/participants', async (req: Request, res: Response) => {
  const { rows } = await query(
    `SELECT id, name, phone, created_at FROM participants WHERE quiz_id = $1 ORDER BY created_at ASC`,
    [req.params.quizId]
  );
  res.json(rows);
});

// POST /api/quizzes/:quizId/participants
router.post('/:quizId/participants', async (req: Request, res: Response) => {
  const { name, phone } = req.body;
  if (!name || !phone) {
    res.status(400).json({ message: 'name and phone required' });
    return;
  }
  const { rows } = await query(
    `INSERT INTO participants (quiz_id, name, phone) VALUES ($1, $2, $3) RETURNING id, name, phone, created_at`,
    [req.params.quizId, name, phone]
  );
  res.status(201).json(rows[0]);
});

// DELETE /api/quizzes/:quizId/participants/:pid
router.delete('/:quizId/participants/:pid', async (req: Request, res: Response) => {
  await query(`DELETE FROM participants WHERE id = $1 AND quiz_id = $2`, [req.params.pid, req.params.quizId]);
  res.status(204).send();
});

// GET /api/quizzes/:quizId/leaderboard
router.get('/:quizId/leaderboard', async (req: Request, res: Response) => {
  const { rows } = await query(
    `SELECT p.id, p.name,
       COALESCE(SUM(ps.points), 0) as total_points,
       COALESCE(SUM(CASE WHEN ps.is_correct THEN 1 ELSE 0 END), 0) as correct_answers
     FROM participants p
     LEFT JOIN participant_scores ps ON ps.participant_id = p.id
     WHERE p.quiz_id = $1
     GROUP BY p.id, p.name
     ORDER BY total_points DESC, correct_answers DESC`,
    [req.params.quizId]
  );
  res.json(rows.map((r, i) => ({ rank: i + 1, participantId: r.id, name: r.name, totalPoints: Number(r.total_points), correctAnswers: Number(r.correct_answers) })));
});

export default router;
