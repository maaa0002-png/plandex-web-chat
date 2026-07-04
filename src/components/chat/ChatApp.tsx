import { useEffect, useRef, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Role = "user" | "assistant";
interface Msg {
  id: string;
  role: Role;
  content: string;
}

const STORAGE_KEY = "plandex-web:messages:v1";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function ChatApp() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load persisted history
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMessages(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignore quota
    }
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function onSubmit(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Msg = { id: uid(), role: "user", content: text };
    const assistantId = uid();
    const nextHistory = [...messages, userMsg];
    setMessages([...nextHistory, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);
    setError(null);

    // Convert to AI SDK UIMessage shape
    const uiMessages = nextHistory.map((m) => ({
      id: m.id,
      role: m.role,
      parts: [{ type: "text", text: m.content }],
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: uiMessages }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "Request failed");
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE-style lines: "data: {...}\n\n"
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          for (const line of part.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const evt = JSON.parse(payload);
              // AI SDK v5 UI stream: text deltas arrive as { type: "text-delta", delta: "..." }
              // and older/newer variants may use { type: "text", text: "..." }
              const delta: string =
                evt.delta ??
                evt.textDelta ??
                (evt.type === "text" ? evt.text : "") ??
                "";
              if (delta) {
                assistantText += delta;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: assistantText } : m)),
                );
              }
            } catch {
              // non-JSON heartbeat, ignore
            }
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
      setError(msg);
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }

  function clearChat() {
    setMessages([]);
    setError(null);
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold sm:text-lg">Plandex Web</h1>
            <p className="truncate text-xs text-muted-foreground">
              مساعد برمجي ذكي — دردشة مباشرة
            </p>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearChat}
              aria-label="مسح المحادثة"
              className="shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
          {messages.length === 0 && <EmptyState onPick={(p) => setInput(p)} />}
          {messages.map((m) => (
            <MessageBubble key={m.id} role={m.role} content={m.content} />
          ))}
          {loading && messages[messages.length - 1]?.content === "" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>جارٍ التفكير...</span>
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
              خطأ: {error}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <form
        onSubmit={onSubmit}
        className="sticky bottom-0 border-t border-border bg-background/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex w-full max-w-3xl items-end gap-2 px-3 py-3">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void onSubmit();
              }
            }}
            placeholder="اكتب رسالتك... (Shift+Enter لسطر جديد)"
            rows={1}
            className="max-h-40 min-h-[48px] resize-none rounded-2xl bg-muted/50 text-base"
          />
          <Button
            type="submit"
            size="icon"
            disabled={loading || !input.trim()}
            className="h-12 w-12 shrink-0 rounded-2xl"
            aria-label="إرسال"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ role, content }: { role: Role; content: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground"
            : "w-full max-w-full text-foreground"
        }
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{content}</p>
        ) : (
          <div className="prose-chat">
            <ReactMarkdown>{content || "…"}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (p: string) => void }) {
  const prompts = [
    "خطط لي هيكل مشروع React + Vite بسيط",
    "اشرح لي الفرق بين useMemo و useCallback",
    "اكتب دالة TypeScript لتصنيف الأخطاء الشبكية",
    "راجع هذا الكود واقترح تحسينات: ...",
  ];
  return (
    <div className="flex flex-col items-center gap-6 py-10 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/15 text-primary">
        <Sparkles className="h-8 w-8" />
      </div>
      <div>
        <h2 className="text-xl font-semibold">أهلاً بك في Plandex Web</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          مساعدك البرمجي — اسأل، خطّط، أو الصق كوداً لمراجعته.
        </p>
      </div>
      <div className="grid w-full gap-2">
        {prompts.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            className="rounded-xl border border-border bg-card px-4 py-3 text-right text-sm text-card-foreground transition hover:border-primary/40 hover:bg-muted"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}