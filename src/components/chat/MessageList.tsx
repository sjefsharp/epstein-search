// Message List Component with auto-scroll
"use client";

import { useEffect, useRef } from "react";
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
          <h2 className="text-2xl font-bold">DOJ Epstein Files Zoeker</h2>
          <p className="text-muted-foreground">
            Zoek in de vrijgegeven documenten van de Epstein rechtszaak. Typ een
            zoekwoord zoals een naam, locatie, of gebeurtenis.
          </p>
          <div className="text-sm space-y-1 text-muted-foreground">
            <p>Voorbeelden:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>&quot;yfke&quot; - specifieke persoon</li>
              <li>&quot;amsterdam&quot; - locatie</li>
              <li>&quot;jeffrey&quot; - Jeffrey Epstein</li>
              <li>&quot;phone call&quot; - type communicatie</li>
            </ul>
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
