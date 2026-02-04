"use client";

import { useCallback, useMemo, useRef } from "react";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import { useChatStore } from "@/store/chat-store";
import { DOJDocument } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

async function readSSE(
  response: Response,
  onChunk: (text: string) => void,
  onDone: () => void,
) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Geen stream beschikbaar in response");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let boundaryIndex = buffer.indexOf("\n\n");

    while (boundaryIndex !== -1) {
      const raw = buffer.slice(0, boundaryIndex).trim();
      buffer = buffer.slice(boundaryIndex + 2);

      if (raw.startsWith("data:")) {
        const payload = raw.replace(/^data:\s*/, "");
        if (payload === "[DONE]") {
          onDone();
          return;
        }

        try {
          const parsed = JSON.parse(payload) as {
            text?: string;
            error?: string;
          };
          if (parsed.error) {
            throw new Error(parsed.error);
          }
          if (parsed.text) {
            onChunk(parsed.text);
          }
        } catch (error) {
          throw error;
        }
      }

      boundaryIndex = buffer.indexOf("\n\n");
    }
  }

  onDone();
}

export default function ChatContainer() {
  const messages = useChatStore((state) => state.messages);
  const searchMode = useChatStore((state) => state.searchMode);
  const isLoading = useChatStore((state) => state.isLoading);
  const currentQuery = useChatStore((state) => state.currentQuery);
  const addMessage = useChatStore((state) => state.addMessage);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const setSearchMode = useChatStore((state) => state.setSearchMode);
  const setLoading = useChatStore((state) => state.setLoading);
  const setCurrentQuery = useChatStore((state) => state.setCurrentQuery);

  const isBusyRef = useRef(false);

  const modeLabel = useMemo(
    () => (searchMode === "fast" ? "Snel" : "Diep"),
    [searchMode],
  );

  const handleSend = useCallback(
    async (message: string) => {
      if (isBusyRef.current) return;
      isBusyRef.current = true;

      setCurrentQuery(message);
      addMessage({ role: "user", content: message });
      const assistantId = addMessage({
        role: "assistant",
        content: "Zoeken in DOJ-archief...",
        isStreaming: true,
      });
      setLoading(true);

      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(message)}`,
        );

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err?.error || "Zoekopdracht mislukt");
        }

        const data = (await response.json()) as {
          documents: DOJDocument[];
          total: number;
          uniqueCount?: number;
        };

        const documents = data.documents || [];
        const uniqueCount = data.uniqueCount ?? documents.length;

        updateMessage(assistantId, {
          content: `**${uniqueCount} document(en) gevonden**. Samenvatting wordt gegenereerd...`,
          isStreaming: true,
          searchResults: documents,
        });

        const summaryResponse = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ searchTerm: message, documents }),
        });

        if (!summaryResponse.ok) {
          const err = await summaryResponse.json();
          throw new Error(err?.error || "Samenvatting mislukt");
        }

        let summaryText = "**Samenvatting**\n\n";
        updateMessage(assistantId, {
          content: summaryText,
          isStreaming: true,
          searchResults: documents,
        });

        await readSSE(
          summaryResponse,
          (chunk) => {
            summaryText += chunk;
            updateMessage(assistantId, {
              content: summaryText,
              isStreaming: true,
            });
          },
          () => {
            updateMessage(assistantId, { isStreaming: false });
          },
        );
      } catch (error) {
        updateMessage(assistantId, {
          content:
            error instanceof Error
              ? `Er ging iets mis: ${error.message}`
              : "Er ging iets mis tijdens het zoeken.",
          isStreaming: false,
        });
      } finally {
        setLoading(false);
        isBusyRef.current = false;
      }
    },
    [addMessage, setLoading, setCurrentQuery, updateMessage],
  );

  const handleAnalyzeDocument = useCallback(
    async (fileUri: string, fileName: string) => {
      if (isBusyRef.current) return;
      isBusyRef.current = true;

      addMessage({
        role: "user",
        content: `Analyseer document: **${fileName}**`,
      });

      const assistantId = addMessage({
        role: "assistant",
        content: `Diepe analyse wordt opgehaald voor **${fileName}**...`,
        isStreaming: true,
      });

      setLoading(true);

      try {
        const response = await fetch("/api/deep-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileUri,
            fileName,
            searchTerm: currentQuery,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err?.error || "Diepe analyse mislukt");
        }

        let summaryText = "**Diepe analyse**\n\n";
        updateMessage(assistantId, {
          content: summaryText,
          isStreaming: true,
        });

        await readSSE(
          response,
          (chunk) => {
            summaryText += chunk;
            updateMessage(assistantId, {
              content: summaryText,
              isStreaming: true,
            });
          },
          () => {
            updateMessage(assistantId, { isStreaming: false });
          },
        );
      } catch (error) {
        updateMessage(assistantId, {
          content:
            error instanceof Error
              ? `Er ging iets mis: ${error.message}`
              : "Er ging iets mis tijdens de diepe analyse.",
          isStreaming: false,
        });
      } finally {
        setLoading(false);
        isBusyRef.current = false;
      }
    },
    [addMessage, updateMessage, setLoading, currentQuery],
  );

  return (
    <section className="flex h-full flex-col rounded-3xl border bg-card/80 backdrop-blur">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            DOJ Epstein Files Agent
          </h1>
          <p className="text-sm text-muted-foreground">
            Zoek direct in DOJ-documenten en krijg een AI-samenvatting.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Mode: {modeLabel}
          </Badge>
          <div className="flex rounded-full border bg-muted p-1">
            <Button
              type="button"
              size="sm"
              variant={searchMode === "fast" ? "default" : "ghost"}
              className={cn(
                "rounded-full px-3",
                searchMode === "fast" && "shadow-sm",
              )}
              onClick={() => setSearchMode("fast")}
              aria-pressed={searchMode === "fast"}
            >
              Snel
            </Button>
            <Button
              type="button"
              size="sm"
              variant={searchMode === "deep" ? "default" : "ghost"}
              className={cn(
                "rounded-full px-3",
                searchMode === "deep" && "shadow-sm",
              )}
              onClick={() => setSearchMode("deep")}
              aria-pressed={searchMode === "deep"}
            >
              Diep
            </Button>
          </div>
        </div>
      </header>

      <MessageList
        messages={messages}
        onAnalyzeDocument={handleAnalyzeDocument}
      />

      <ChatInput
        onSend={handleSend}
        disabled={isLoading}
        placeholder="Zoek in DOJ Epstein files… (bijv. 'yfke', 'amsterdam', 'phone call')"
      />

      <div className="px-6 pb-4 text-xs text-muted-foreground">
        Tip: klik op “Diepe analyse uitvoeren” om een PDF on-demand te laten
        analyseren.
      </div>
    </section>
  );
}
