// Message List Component with auto-scroll
"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Message as MessageType } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import Message from "./Message";

interface MessageListProps {
  messages: MessageType[];
  onAnalyzeDocument?: (fileUri: string, fileName: string) => void;
}

export default function MessageList({
  messages,
  onAnalyzeDocument,
}: MessageListProps) {
  const t = useTranslations("MessageList");
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-2xl font-bold">{t("emptyTitle")}</h2>
          <p className="text-muted-foreground">{t("emptyDescription")}</p>
          <div className="text-sm space-y-1 text-muted-foreground">
            <p>{t("emptyExamples")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1" ref={scrollAreaRef}>
      <div className="p-4 space-y-4">
        {messages.map((message) => (
          <Message
            key={message.id}
            message={message}
            onAnalyzeDocument={onAnalyzeDocument}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
