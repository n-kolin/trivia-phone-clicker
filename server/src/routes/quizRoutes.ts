import { Router, Request, Response } from 'express';
import * as quizRepository from '../repositories/quizRepository';
import * as quizManager from '../services/quizManager';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req: Request, res: Response) => {
  const quizzes = await quizRepository.getAllQuizzes();
  res.json(quizzes);
});

router.post('/', async (req: Request, res: Response) => {
  const quiz = await quizRepository.createQuiz(req.body);
  res.status(201).json(quiz);
});

router.get('/:id', async (req: Request, res: Response) => {
  const quiz = await quizRepository.getQuiz(req.params.id);
  if (!quiz) {
    res.status(404).json({ code: 'QUIZ_NOT_FOUND', message: 'Quiz not found' });
    return;
  }
  res.json(quiz);
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await quizRepository.deleteQuiz(req.params.id);
    if (!deleted) {
      res.status(404).json({ code: 'QUIZ_NOT_FOUND', message: 'Quiz not found' });
      return;
    }
    res.status(204).send();
  } catch (err: unknown) {
    res.status(409).json({ code: 'CONFLICT', message: (err as Error).message });
  }
});

router.post('/:id/questions', async (req: Request, res: Response) => {
  const { questionId, order } = req.body;
  await quizRepository.addQuestionToQuiz(req.params.id, questionId, order);
  res.status(200).json({ message: 'Question added' });
});

router.delete('/:id/questions/:qid', async (req: Request, res: Response) => {
  try {
    await quizRepository.removeQuestionFromQuiz(req.params.id, req.params.qid);
    res.status(204).send();
  } catch (err: unknown) {
    res.status(409).json({ code: 'CONFLICT', message: (err as Error).message });
  }
});

router.put('/:id/questions/reorder', async (req: Request, res: Response) => {
  const { questionIds } = req.body;
  await quizRepository.reorderQuestions(req.params.id, questionIds);
  res.json({ message: 'Reordered' });
});

router.post('/:id/start', async (req: Request, res: Response) => {
  await quizRepository.updateQuizStatus(req.params.id, 'active');
  res.json({ message: 'Quiz started' });
});

router.post('/:id/questions/:qid/activate', async (req: Request, res: Response) => {
  await quizManager.activateQuestion(req.params.id, req.params.qid);
  res.json({ message: 'Question activated' });
});

router.post('/:id/questions/:qid/stop', async (req: Request, res: Response) => {
  await quizManager.stopQuestion(req.params.id);
  res.json({ message: 'Question stopped' });
});

router.post('/:id/questions/:qid/reveal', async (req: Request, res: Response) => {
  await quizManager.revealAnswer(req.params.id, req.params.qid);
  res.json({ message: 'Answer revealed' });
});

router.post('/:id/end', async (req: Request, res: Response) => {
  await quizManager.endQuiz(req.params.id);
  res.json({ message: 'Quiz ended' });
});

router.get('/:id/results/:qid', async (req: Request, res: Response) => {
  const results = await quizManager.getResults(req.params.id, req.params.qid);
  res.json(results);
});

export default router;
