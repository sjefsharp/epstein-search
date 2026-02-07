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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    use: (...args: any[]) => void;
    listen: (port: number, cb?: () => void) => void;
  }

  interface ExpressStatic {
    (): ExpressApp;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json: (options?: any) => any;
  }

  const express: ExpressStatic;
  export default express;
}

declare module "playwright" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const chromium: any;
}

declare module "pdf-parse" {
  const pdfParse: (buffer: Buffer) => Promise<{
    text?: string;
    numpages?: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    info?: any;
  }>;
  export default pdfParse;
}
