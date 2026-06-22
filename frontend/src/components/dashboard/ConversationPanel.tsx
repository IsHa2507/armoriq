import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types/agent";

interface ConversationPanelProps {
  conversation: Conversation | undefined;
  onSend: (conversationId: string, content: string) => Promise<void>;
}

export function ConversationPanel({ conversation, onSend }: ConversationPanelProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !conversation) return;
    setSending(true);
    try {
      await onSend(conversation.id, input.trim());
      setInput("");
    } finally {
      setSending(false);
    }
  }

  if (!conversation) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-neutral-400">Select a conversation to get started.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <p className="text-sm font-medium text-neutral-900 dark:text-white">
          {conversation.title}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {conversation.messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white"
              )}
            >
              <p>{msg.content}</p>
              <time
                dateTime={msg.timestamp}
                className={cn(
                  "mt-1 block text-[10px]",
                  msg.role === "user" ? "text-blue-200" : "text-neutral-400"
                )}
              >
                {new Date(msg.timestamp).toLocaleTimeString()}
              </time>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="border-t border-neutral-200 p-3 dark:border-neutral-800"
      >
        <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message agent…"
            disabled={sending}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            aria-label="Send message"
            className="rounded-lg p-1.5 text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-40 dark:text-blue-400 dark:hover:bg-blue-900/20"
          >
            <Send size={14} aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}
