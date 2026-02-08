import express, { Request, Response } from 'express';
const app = express();
const limiter = (req: Request, res: Response, next: () => void) => next();
app.post("/test", limiter, async (req: Request, res: Response) => {
  res.json({ ok: true });
});
