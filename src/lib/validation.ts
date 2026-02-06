// Input validation schemas using Zod
import { z } from "zod";

/**
 * Search query validation schema
 * Prevents injection attacks and validates input
 */
export const searchSchema = z.object({
  query: z
    .string()
    .min(1, "Query cannot be empty")
    .max(500, "Query too long")
    .regex(/^[a-zA-Z0-9\s\-._]+$/, "Query contains invalid characters"),
  from: z.number().int().min(0).max(10000).default(0),
  size: z.number().int().min(1).max(100).default(100),
});

/**
 * Analyze request validation schema
 * Prevents SSRF by validating domain and protocol
 */
export const analyzeSchema = z.object({
  fileUri: z
    .string()
    .url("Invalid URL")
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          // Enforce HTTPS only
          if (parsed.protocol !== "https:") {
            return false;
          }
          // Only allow justice.gov domains
          return (
            parsed.hostname.endsWith(".justice.gov") ||
            parsed.hostname === "justice.gov"
          );
        } catch {
          return false;
        }
      },
      { message: "Only HTTPS justice.gov URLs are allowed" },
    ),
  fileName: z.string().min(1, "fileName is required").max(255),
  searchTerm: z.string().max(500).optional(),
});

/**
 * Deep analyze request schema
 */
export const deepAnalyzeSchema = z.object({
  fileUri: z
    .string()
    .url("Invalid URL")
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          return (
            parsed.hostname.endsWith(".justice.gov") ||
            parsed.hostname === "justice.gov"
          );
        } catch {
          return false;
        }
      },
      { message: "Only justice.gov URLs are allowed" },
    ),
  fileName: z.string().min(1).max(255),
  searchTerm: z.string().max(500).optional(),
});

/**
 * Consent log schema
 */
export const consentLogSchema = z.object({
  eventType: z.enum(["accept", "reject", "update", "withdraw"]),
  adsConsent: z.boolean(),
  locale: z.enum(["en", "nl", "fr", "de", "es", "pt"]),
  policyVersion: z
    .string()
    .min(1)
    .max(32)
    .regex(/^\d+\.\d+\.\d+$/, "policyVersion must be semver"),
  eventTimestamp: z.string().datetime(),
});
