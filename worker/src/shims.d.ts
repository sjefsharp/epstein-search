declare module "pdf-parse" {
  const pdfParse: (buffer: Buffer) => Promise<{
    text?: string;
    numpages?: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    info?: any;
  }>;
  export default pdfParse;
}
