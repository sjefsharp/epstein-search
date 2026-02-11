import crypto from "crypto";

const usage = `
Usage:
  WORKER_SHARED_SECRET=... tsx worker/scripts/signed-request.ts search --query "epstein" --from 0 --size 10
  WORKER_SHARED_SECRET=... tsx worker/scripts/signed-request.ts analyze --fileUri "https://www.justice.gov/.../file.pdf"

Optional flags:
  --baseUrl http://localhost:3000
  --header X-Worker-Signature | Authorization
`;

type Args = Record<string, string | undefined>;

const parseArgs = (argv: string[]): Args => {
  const args: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value.startsWith("--")) {
      const key = value.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = "true";
      }
    }
  }
  return args;
};

const getNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const main = async () => {
  const [, , command, ...rest] = process.argv;
  const args = parseArgs(rest);
  const sharedSecret = process.env.WORKER_SHARED_SECRET;

  if (!sharedSecret) {
    throw new Error("WORKER_SHARED_SECRET is required.");
  }

  if (!command || (command !== "search" && command !== "analyze")) {
    throw new Error(`Missing or invalid command. ${usage}`);
  }

  const baseUrl = args.baseUrl || process.env.WORKER_URL || "http://localhost:3000";
  const headerMode = args.header || "Authorization";

  let body: Record<string, unknown>;
  let endpoint: string;

  if (command === "search") {
    const query = args.query || "epstein";
    const from = getNumber(args.from, 0);
    const size = getNumber(args.size, 10);
    body = { query, from, size };
    endpoint = "search";
  } else {
    const fileUri = args.fileUri || args.fileuri;
    if (!fileUri) {
      throw new Error(`--fileUri is required for analyze. ${usage}`);
    }
    body = { fileUri };
    endpoint = "analyze";
  }

  const payload = JSON.stringify(body);
  const signature = crypto.createHmac("sha256", sharedSecret).update(payload).digest("hex");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (headerMode === "X-Worker-Signature") {
    headers["X-Worker-Signature"] = signature;
  } else {
    headers.Authorization = `Bearer ${signature}`;
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/${endpoint}`, {
    method: "POST",
    headers,
    body: payload,
  });

  const contentType = response.headers.get("content-type") || "";
  const raw = await response.text();

  const output = contentType.includes("application/json") ? JSON.parse(raw) : raw;
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
