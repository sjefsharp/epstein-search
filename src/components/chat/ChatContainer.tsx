"use client";

import { useLocale, useTranslations } from "next-intl";

import { useCallback, useMemo, useRef } from "react";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import { useChatStore } from "@/store/chat-store";
import { DOJDocument } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import AgeVerification from "@/components/gates/AgeVerification";

async function readSSE(
  response: Response,
  onChunk: (text: string) => void,
  onDone: () => void,
  noStreamMessage: string,
) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error(noStreamMessage);
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
  const locale = useLocale();
  const t = useTranslations("ChatContainer");
  const tErrors = useTranslations("Errors");
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
    () => (searchMode === "fast" ? t("modeFast") : t("modeDeep")),
    [searchMode, t],
  );

  const handleSend = useCallback(
    async (message: string) => {
      if (isBusyRef.current) return;
      isBusyRef.current = true;

      setCurrentQuery(message);
      addMessage({ role: "user", content: message });
      const assistantId = addMessage({
        role: "assistant",
        content: t("searchingArchive"),
        isStreaming: true,
      });
      setLoading(true);

      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(message)}&locale=${encodeURIComponent(locale)}`,
        );

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err?.error || tErrors("searchFailed"));
        }

        const data = (await response.json()) as {
          documents: DOJDocument[];
          total: number;
          uniqueCount?: number;
        };

        const documents = data.documents || [];
        const uniqueCount = data.uniqueCount ?? documents.length;

        updateMessage(assistantId, {
          content: t("documentsFound", { count: uniqueCount }),
          isStreaming: true,
          searchResults: documents,
        });

        const summaryResponse = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ searchTerm: message, documents, locale }),
        });

        if (!summaryResponse.ok) {
          const err = await summaryResponse.json();
          throw new Error(err?.error || tErrors("summaryFailed"));
        }

        let summaryText = `${t("summaryHeading")}\n\n`;
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
          t("noStream"),
        );
      } catch (error) {
        updateMessage(assistantId, {
          content:
            error instanceof Error
              ? `${tErrors("searchFailed")} ${error.message}`
              : tErrors("searchFailed"),
          isStreaming: false,
        });
      } finally {
        setLoading(false);
        isBusyRef.current = false;
      }
    },
    [addMessage, locale, setLoading, setCurrentQuery, t, tErrors, updateMessage],
  );

  const handleAnalyzeDocument = useCallback(
    async (fileUri: string, fileName: string) => {
      if (isBusyRef.current) return;
      isBusyRef.current = true;

      addMessage({
        role: "user",
        content: t("analyzeDocument", { fileName }),
      });

      const assistantId = addMessage({
        role: "assistant",
        content: t("deepAnalyzeFetching", { fileName }),
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
            locale,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err?.error || tErrors("summaryFailed"));
        }

        let summaryText = `${t("deepAnalysisHeading")}\n\n`;
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
          t("noStream"),
        );
      } catch (error) {
        updateMessage(assistantId, {
          content:
            error instanceof Error
              ? `${tErrors("summaryFailed")} ${error.message}`
              : tErrors("summaryFailed"),
          isStreaming: false,
        });
      } finally {
        setLoading(false);
        isBusyRef.current = false;
      }
    },
    [addMessage, currentQuery, locale, setLoading, t, tErrors, updateMessage],
  );

  return (
    <section className="relative flex h-full flex-col overflow-hidden rounded-3xl border bg-card/80 backdrop-blur">
      <AgeVerification />
      <header className="flex items-center justify-between border-b px-4 py-2 sm:px-5 sm:py-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{t("headerTitle")}</h2>
          <p className="text-xs text-muted-foreground sm:text-sm">{t("headerSubtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {t("modeLabel", { mode: modeLabel })}
          </Badge>
          <div className="flex rounded-full border bg-muted p-1">
            <Button
              type="button"
              size="sm"
              variant={searchMode === "fast" ? "default" : "ghost"}
              className={cn("rounded-full px-3", searchMode === "fast" && "shadow-sm")}
              onClick={() => setSearchMode("fast")}
              aria-pressed={searchMode === "fast"}
            >
              {t("modeFast")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={searchMode === "deep" ? "default" : "ghost"}
              className={cn("rounded-full px-3", searchMode === "deep" && "shadow-sm")}
              onClick={() => setSearchMode("deep")}
              aria-pressed={searchMode === "deep"}
            >
              {t("modeDeep")}
            </Button>
          </div>
        </div>
      </header>

      <MessageList messages={messages} onAnalyzeDocument={handleAnalyzeDocument} />

      <ChatInput onSend={handleSend} disabled={isLoading} />

      <div className="hidden px-6 pb-4 text-xs text-muted-foreground sm:block">{t("tip")}</div>
    </section>
  );
}
