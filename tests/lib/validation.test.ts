import { searchSchema, analyzeSchema } from "@/lib/validation";

describe("validation schemas", () => {
  describe("searchSchema", () => {
    it("validates correct search query", () => {
      const result = searchSchema.safeParse({
        query: "epstein",
        from: 0,
        size: 10,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query).toBe("epstein");
        expect(result.data.from).toBe(0);
        expect(result.data.size).toBe(10);
      }
    });

    it("applies default values for from and size", () => {
      const result = searchSchema.safeParse({ query: "test" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.from).toBe(0);
        expect(result.data.size).toBe(100);
      }
    });

    it("rejects empty query", () => {
      const result = searchSchema.safeParse({ query: "" });
      expect(result.success).toBe(false);
    });

    it("rejects query with invalid characters", () => {
      const result = searchSchema.safeParse({ query: "test<script>" });
      expect(result.success).toBe(false);
    });

    it("rejects query that is too long", () => {
      const longQuery = "a".repeat(501);
      const result = searchSchema.safeParse({ query: longQuery });
      expect(result.success).toBe(false);
    });

    it("rejects negative from value", () => {
      const result = searchSchema.safeParse({
        query: "test",
        from: -1,
        size: 10,
      });
      expect(result.success).toBe(false);
    });

    it("rejects size greater than 100", () => {
      const result = searchSchema.safeParse({
        query: "test",
        from: 0,
        size: 101,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("analyzeSchema", () => {
    it("validates correct justice.gov URL", () => {
      const result = analyzeSchema.safeParse({
        fileUri: "https://www.justice.gov/files/epstein.pdf",
        fileName: "epstein.pdf",
      });

      expect(result.success).toBe(true);
    });

    it("accepts fileName without searchTerm", () => {
      const result = analyzeSchema.safeParse({
        fileUri: "https://www.justice.gov/files/test.pdf",
        fileName: "test.pdf",
      });

      expect(result.success).toBe(true);
    });

    it("accepts with searchTerm", () => {
      const result = analyzeSchema.safeParse({
        fileUri: "https://www.justice.gov/files/test.pdf",
        fileName: "test.pdf",
        searchTerm: "epstein",
      });

      expect(result.success).toBe(true);
    });

    it("rejects non-justice.gov URLs", () => {
      const result = analyzeSchema.safeParse({
        fileUri: "https://example.com/file.pdf",
        fileName: "file.pdf",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("HTTPS justice.gov URLs are allowed");
      }
    });

    it("rejects HTTP URLs (requires HTTPS)", () => {
      const result = analyzeSchema.safeParse({
        fileUri: "http://www.justice.gov/files/test.pdf",
        fileName: "test.pdf",
      });

      expect(result.success).toBe(false);
    });

    it("rejects invalid URLs", () => {
      const result = analyzeSchema.safeParse({
        fileUri: "not-a-url",
        fileName: "test.pdf",
      });

      expect(result.success).toBe(false);
    });

    it("accepts subdomain of justice.gov", () => {
      const result = analyzeSchema.safeParse({
        fileUri: "https://files.justice.gov/epstein.pdf",
        fileName: "epstein.pdf",
      });

      expect(result.success).toBe(true);
    });

    it("rejects fileName that is too long", () => {
      const longName = "a".repeat(256) + ".pdf";
      const result = analyzeSchema.safeParse({
        fileUri: "https://www.justice.gov/test.pdf",
        fileName: longName,
      });

      expect(result.success).toBe(false);
    });
  });
});
