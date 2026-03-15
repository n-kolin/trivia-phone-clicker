import { Router, Request, Response } from 'express';
import * as questionRepository from '../repositories/questionRepository';
import { authMiddleware } from '../middleware/authMiddleware';
import { ApiError, ErrorCodes } from '../../../shared/types/index';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req: Request, res: Response) => {
  const questions = await questionRepository.getAllQuestions();
  res.json(questions);
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const question = await questionRepository.createQuestion(req.body);
    res.status(201).json(question);
  } catch (err: unknown) {
    const apiErr = err as ApiError;
    if (apiErr?.code === ErrorCodes.INVALID_ANSWER_OPTIONS) {
      res.status(400).json(apiErr);
    } else {
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  const question = await questionRepository.getQuestion(req.params.id);
  if (!question) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Question not found' });
    return;
  }
  res.json(question);
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const question = await questionRepository.updateQuestion(req.params.id, req.body);
    if (!question) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Question not found' });
      return;
    }
    res.json(question);
  } catch (err: unknown) {
    const apiErr = err as ApiError;
    if (apiErr?.code === ErrorCodes.INVALID_ANSWER_OPTIONS) {
      res.status(400).json(apiErr);
    } else {
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await questionRepository.deleteQuestion(req.params.id);
    if (!deleted) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Question not found' });
      return;
    }
    res.status(204).send();
  } catch (err: unknown) {
    const apiErr = err as ApiError;
    if (apiErr?.code === ErrorCodes.QUESTION_IN_ACTIVE_QUIZ) {
      res.status(409).json(apiErr);
    } else {
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  }
});

export default router;
