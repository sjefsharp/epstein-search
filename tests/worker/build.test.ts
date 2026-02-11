import { describe, it } from "vitest";
import path from "path";
import { spawnSync } from "child_process";

const runWorkerTypecheck = (): void => {
  const tscPath = path.resolve(process.cwd(), "node_modules", "typescript", "bin", "tsc");
  const result = spawnSync(process.execPath, [tscPath, "-p", "worker/tsconfig.json", "--noEmit"], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(`Worker TypeScript build failed.\n${output}`);
  }
};

describe("Worker build", () => {
  it("typechecks the worker project", () => {
    runWorkerTypecheck();
  }, 20000);
});
