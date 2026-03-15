import { Router, Request, Response } from 'express';
import * as reportService from '../services/reportService';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();
router.use(authMiddleware);

router.get('/:quizId', async (req: Request, res: Response) => {
  const report = await reportService.getQuizReport(req.params.quizId);
  if (!report) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Report not found' });
    return;
  }
  res.json(report);
});

router.get('/:quizId/export/csv', async (req: Request, res: Response) => {
  const report = await reportService.getQuizReport(req.params.quizId);
  if (!report) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Report not found' });
    return;
  }
  const csv = reportService.exportToCsv(report);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="quiz-${req.params.quizId}.csv"`);
  res.send(csv);
});

export default router;
