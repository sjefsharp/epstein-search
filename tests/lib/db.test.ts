const queryMock = vi.fn();

class PoolMock {
  query = queryMock;
}

vi.mock("pg", () => ({
  Pool: PoolMock,
}));

describe("db", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    queryMock.mockReset();
    queryMock.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws when connection string is missing", async () => {
    delete process.env.NEON_DATABASE_URL;

    const { getDbPool } = await import("../../src/lib/db");

    expect(() => getDbPool()).toThrow(/NEON_DATABASE_URL/);
  });

  it("creates pool and runs queries", async () => {
    process.env.NEON_DATABASE_URL = "postgres://example";
    queryMock.mockResolvedValue({ rows: [{ id: 1 }] });

    const { runQuery } = await import("../../src/lib/db");

    const result = await runQuery("select 1");

    expect(queryMock).toHaveBeenCalledWith("select 1", []);
    expect(result.rows[0].id).toBe(1);
  });
});
