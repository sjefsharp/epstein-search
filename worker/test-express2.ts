import express from "express";
import type { Request, Response, NextFunction } from "express";

const app = express();
const limiter = (req: Request, res: Response, next: NextFunction) => next();

app.post("/test", limiter, async (req: Request, res: Response) => {
  res.json({ ok: true });
});
