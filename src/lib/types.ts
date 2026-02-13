// TypeScript types for DOJ documents and search results

export type SupportedLocale = "en" | "nl" | "fr" | "de" | "es" | "pt";

export interface DOJSearchParams {
  query: string;
  from?: number;
  size?: number;
}

export interface DOJDocument {
  documentId: string;
  chunkIndex: number;
  totalChunks: number;
  startPage: number;
  endPage: number;
  fileName: string;
  fileUri: string;
  fileSize: number;
  totalWords: number;
  totalCharacters: number;
  processedAt: string;
  content: string;
  highlights: string[];
  bucket: string;
  key: string;
}

export interface DOJSearchResponse {
  total: number;
  documents: DOJDocument[];
  searchTerm: string;
  from: number;
  size: number;
}

export interface DOJAPIResponse {
  hits: {
    total: {
      value: number;
    };
    hits: Array<{
      _source: {
        documentId: string;
        chunkIndex: number;
        totalChunks: number;
        startPage: number;
        endPage: number;
        ORIGIN_FILE_NAME: string;
        ORIGIN_FILE_URI: string;
        bucket: string;
        key: string;
        fileSize: number;
        totalWords: number;
        totalCharacters: number;
        processedAt: string;
      };
      highlight?: {
        content?: string[];
      };
      _source_content?: string;
    }>;
  };
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  searchResults?: DOJDocument[];
  isStreaming?: boolean;
}

export interface ChatState {
  messages: Message[];
  searchMode: "fast" | "deep";
  isLoading: boolean;
  currentQuery: string;
}
