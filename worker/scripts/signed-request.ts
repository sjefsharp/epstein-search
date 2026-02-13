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
  const args: Args = {
    baseUrl: undefined,
    header: undefined,
    query: undefined,
    from: undefined,
    size: undefined,
    fileUri: undefined,
    fileuri: undefined,
  };
  for (let i = 0; i < argv.length; i += 1) {
    // eslint-disable-next-line security/detect-object-injection
    const value = argv[i];
    if (value.startsWith("--")) {
      const next = argv[i + 1];
      const parsedValue = next && !next.startsWith("--") ? next : "true";
      switch (value) {
        case "--baseUrl":
          args.baseUrl = parsedValue;
          break;
        case "--header":
          args.header = parsedValue;
          break;
        case "--query":
          args.query = parsedValue;
          break;
        case "--from":
          args.from = parsedValue;
          break;
        case "--size":
          args.size = parsedValue;
          break;
        case "--fileUri":
          args.fileUri = parsedValue;
          break;
        case "--fileuri":
          args.fileuri = parsedValue;
          break;
        default:
          break;
      }

      if (next && !next.startsWith("--")) {
        i += 1;
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
  const headers: Record<string, string> =
    headerMode === "X-Worker-Signature"
      ? {
          "Content-Type": "application/json",
          "X-Worker-Signature": signature,
        }
      : {
          "Content-Type": "application/json",
          Authorization: `Bearer ${signature}`,
        };

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
