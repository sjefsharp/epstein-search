// Document metadata cache in Neon Postgres
// Stores DOJ document metadata for offline search when DOJ/worker is unavailable.
// Estimated storage: ~15 MB for ~2,000 documents (3% of Neon free tier).

import { runQuery } from "./db";
import type { DOJDocument, DOJSearchResponse } from "./types";

// ---------------------------------------------------------------------------
// Table initialisation
// ---------------------------------------------------------------------------

/**
 * Create the documents table if it doesn't exist.
 * Called lazily on first use — safe to call multiple times.
 */
export async function ensureDocumentsTable(): Promise<void> {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS documents (
      document_id     TEXT PRIMARY KEY,
      chunk_index     INTEGER NOT NULL DEFAULT 0,
      total_chunks    INTEGER NOT NULL DEFAULT 1,
      start_page      INTEGER NOT NULL DEFAULT 0,
      end_page        INTEGER NOT NULL DEFAULT 0,
      file_name       TEXT NOT NULL,
      file_uri        TEXT NOT NULL,
      file_size       INTEGER NOT NULL DEFAULT 0,
      total_words     INTEGER NOT NULL DEFAULT 0,
      total_chars     INTEGER NOT NULL DEFAULT 0,
      processed_at    TEXT,
      content         TEXT NOT NULL DEFAULT '',
      highlights      TEXT[] NOT NULL DEFAULT '{}',
      bucket          TEXT NOT NULL DEFAULT '',
      key             TEXT NOT NULL DEFAULT '',
      crawled_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      search_vector   tsvector GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(file_name, '') || ' ' || coalesce(content, ''))
      ) STORED
    )
  `);

  // GIN index for full-text search
  await runQuery(`
    CREATE INDEX IF NOT EXISTS idx_documents_search
    ON documents USING GIN (search_vector)
  `);

  // Index on file_uri for deep-analyze lookups
  await runQuery(`
    CREATE INDEX IF NOT EXISTS idx_documents_file_uri
    ON documents (file_uri)
  `);
}

// ---------------------------------------------------------------------------
// Upsert documents
// ---------------------------------------------------------------------------

/**
 * Upsert a batch of DOJDocument records into the documents table.
 * Uses ON CONFLICT to update existing rows.
 */
export async function upsertDocuments(documents: DOJDocument[]): Promise<number> {
  if (documents.length === 0) return 0;

  let upserted = 0;
  for (const doc of documents) {
    await runQuery(
      `INSERT INTO documents (
        document_id, chunk_index, total_chunks, start_page, end_page,
        file_name, file_uri, file_size, total_words, total_chars,
        processed_at, content, highlights, bucket, key, crawled_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
      ON CONFLICT (document_id) DO UPDATE SET
        chunk_index  = EXCLUDED.chunk_index,
        total_chunks = EXCLUDED.total_chunks,
        start_page   = EXCLUDED.start_page,
        end_page     = EXCLUDED.end_page,
        file_name    = EXCLUDED.file_name,
        file_uri     = EXCLUDED.file_uri,
        file_size    = EXCLUDED.file_size,
        total_words  = EXCLUDED.total_words,
        total_chars  = EXCLUDED.total_chars,
        processed_at = EXCLUDED.processed_at,
        content      = EXCLUDED.content,
        highlights   = EXCLUDED.highlights,
        bucket       = EXCLUDED.bucket,
        key          = EXCLUDED.key,
        crawled_at   = NOW()`,
      [
        doc.documentId,
        doc.chunkIndex,
        doc.totalChunks,
        doc.startPage,
        doc.endPage,
        doc.fileName,
        doc.fileUri,
        doc.fileSize,
        doc.totalWords,
        doc.totalCharacters,
        doc.processedAt,
        doc.content,
        doc.highlights,
        doc.bucket,
        doc.key,
      ],
    );
    upserted++;
  }
  return upserted;
}

// ---------------------------------------------------------------------------
// Full-text search fallback
// ---------------------------------------------------------------------------

interface DocumentRow {
  document_id: string;
  chunk_index: number;
  total_chunks: number;
  start_page: number;
  end_page: number;
  file_name: string;
  file_uri: string;
  file_size: number;
  total_words: number;
  total_chars: number;
  processed_at: string;
  content: string;
  highlights: string[];
  bucket: string;
  key: string;
}

/**
 * Search the local documents cache using Postgres full-text search.
 * Returns results in the same DOJSearchResponse format as the DOJ API.
 */
export async function searchDocumentsLocal(
  query: string,
  from: number = 0,
  size: number = 100,
): Promise<DOJSearchResponse | null> {
  try {
    // Count total matches
    const countResult = await runQuery<{ count: string }>(
      `SELECT COUNT(*) as count FROM documents
       WHERE search_vector @@ plainto_tsquery('english', $1)`,
      [query],
    );

    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);
    if (total === 0) return null;

    // Fetch ranked results
    const result = await runQuery<DocumentRow>(
      `SELECT
        document_id, chunk_index, total_chunks, start_page, end_page,
        file_name, file_uri, file_size, total_words, total_chars,
        processed_at, content, highlights, bucket, key
      FROM documents
      WHERE search_vector @@ plainto_tsquery('english', $1)
      ORDER BY ts_rank(search_vector, plainto_tsquery('english', $1)) DESC
      LIMIT $2 OFFSET $3`,
      [query, Math.min(size, 100), from],
    );

    const documents: DOJDocument[] = result.rows.map((row) => ({
      documentId: row.document_id,
      chunkIndex: row.chunk_index,
      totalChunks: row.total_chunks,
      startPage: row.start_page,
      endPage: row.end_page,
      fileName: row.file_name,
      fileUri: row.file_uri,
      fileSize: row.file_size,
      totalWords: row.total_words,
      totalCharacters: row.total_chars,
      processedAt: row.processed_at,
      content: row.content,
      highlights: row.highlights ?? [],
      bucket: row.bucket,
      key: row.key,
    }));

    return {
      total,
      documents,
      searchTerm: query,
      from,
      size,
    };
  } catch (error) {
    process.stderr.write(
      `[documents] Local search failed: ${error instanceof Error ? error.message : "unknown"}\n`,
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/**
 * Get the count of cached documents and the last crawl timestamp.
 */
export async function getDocumentStats(): Promise<{
  count: number;
  lastCrawl: string | null;
}> {
  try {
    const result = await runQuery<{ count: string; last_crawl: string | null }>(
      `SELECT COUNT(*) as count, MAX(crawled_at)::text as last_crawl FROM documents`,
    );
    return {
      count: parseInt(result.rows[0]?.count ?? "0", 10),
      lastCrawl: result.rows[0]?.last_crawl ?? null,
    };
  } catch {
    return { count: 0, lastCrawl: null };
  }
}
