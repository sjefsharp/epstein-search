declare module "express" {
  import { IncomingMessage, ServerResponse } from "http";

  export interface Request extends IncomingMessage {
    body?: unknown;
  }

  export interface Response extends ServerResponse {
    json: (body?: unknown) => Response;
    status: (code: number) => Response;
  }

  interface ExpressApp {
    get: (
      path: string,
      handler: (req: Request, res: Response) => void | Promise<void>,
    ) => void;
    post: (
      path: string,
      handler: (req: Request, res: Response) => void | Promise<void>,
    ) => void;
    use: (...args: unknown[]) => void;
    listen: (port: number, cb?: () => void) => void;
  }

  interface ExpressStatic {
    (): ExpressApp;
    json: (options?: unknown) => unknown;
  }

  const express: ExpressStatic;
  export default express;
}

declare module "playwright" {
  export const chromium: unknown;
}

declare module "pdf-parse" {
  const pdfParse: (buffer: Buffer) => Promise<{
    text?: string;
    numpages?: number;
    info?: unknown;
  }>;
  export default pdfParse;
}
