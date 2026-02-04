// Individual Message Component
"use client";

import { Message as MessageType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { User, Bot, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";

interface MessageProps {
  message: MessageType;
  onAnalyzeDocument?: (fileUri: string, fileName: string) => void;
}

export default function Message({ message, onAnalyzeDocument }: MessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 p-4 rounded-lg",
        isUser
          ? "ml-auto max-w-[80%] bg-primary text-primary-foreground"
          : "mr-auto max-w-[90%] bg-muted",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser
            ? "bg-primary-foreground text-primary"
            : "bg-primary text-primary-foreground",
        )}
      >
        {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-3">
        {/* Message content */}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {message.isStreaming ? (
            <div className="flex items-center gap-2">
              <span>{message.content}</span>
              <span className="animate-pulse">▊</span>
            </div>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          )}
        </div>

        {/* Search results (if any) */}
        {message.searchResults && message.searchResults.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-sm font-semibold">
              {message.searchResults.length} document(en) gevonden:
            </p>
            <div className="space-y-2">
              {message.searchResults.slice(0, 5).map((doc) => (
                <div
                  key={doc.documentId}
                  className="p-3 rounded-md bg-background border text-sm space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium">{doc.fileName}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          Pagina {doc.startPage}-{doc.endPage}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {doc.totalWords} woorden
                        </Badge>
                      </div>
                    </div>
                    <a
                      href={doc.fileUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                      aria-label={`Open ${doc.fileName} in nieuw tabblad`}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>

                  {/* Highlighted content */}
                  {doc.highlights.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <div
                        dangerouslySetInnerHTML={{
                          __html: doc.highlights[0].substring(0, 200) + "...",
                        }}
                      />
                    </div>
                  )}

                  {/* Deep analyze button */}
                  {onAnalyzeDocument && (
                    <button
                      onClick={() =>
                        onAnalyzeDocument(doc.fileUri, doc.fileName)
                      }
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      → Diepe analyse uitvoeren
                    </button>
                  )}
                </div>
              ))}
            </div>

            {message.searchResults.length > 5 && (
              <p className="text-xs text-muted-foreground">
                ... en nog {message.searchResults.length - 5} andere documenten
              </p>
            )}
          </div>
        )}

        {/* Timestamp */}
        <time className="text-xs opacity-60">
          {new Date(message.timestamp).toLocaleTimeString("nl-NL", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>
    </div>
  );
}
