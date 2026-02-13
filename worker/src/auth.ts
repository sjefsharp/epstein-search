import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

const getHeaderValue = (header: string | string[] | undefined): string | undefined => {
  if (typeof header === "string") {
    return header;
  }

  if (Array.isArray(header)) {
    return header[0];
  }

  return undefined;
};

export const extractWorkerSignature = (req: Request): string | undefined => {
  const signatureHeader = getHeaderValue(req.headers["x-worker-signature"]);
  const authHeader = getHeaderValue(req.headers.authorization);

  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : undefined;

  return signatureHeader || bearerToken;
};

export const computeWorkerSignature = (payload: string, sharedSecret: string): string => {
  return crypto.createHmac("sha256", sharedSecret).update(payload).digest("hex");
};

export const verifyWorkerSignature = (
  payload: string,
  signature: string,
  sharedSecret: string,
): boolean => {
  const expected = computeWorkerSignature(payload, sharedSecret);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
};

export const requireWorkerSignature = (req: Request, res: Response, next: NextFunction): void => {
  const sharedSecret = process.env.WORKER_SHARED_SECRET;

  if (!sharedSecret) {
    process.stderr.write("WORKER_SHARED_SECRET not configured\n");
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const signature = extractWorkerSignature(req);
  if (!signature) {
    res.status(401).json({ error: "Missing authentication signature" });
    return;
  }

  const payload = JSON.stringify(req.body);

  if (!verifyWorkerSignature(payload, signature, sharedSecret)) {
    res.status(403).json({ error: "Invalid signature" });
    return;
  }

  next();
};
