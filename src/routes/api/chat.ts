import { createFileRoute } from "@tanstack/react-router";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `أنت "Plandex Web" — مساعد برمجي ذكي يعمل عبر واجهة دردشة.
- ساعد المستخدم على التخطيط للمهام البرمجية، تحليل الكود، اقتراح البنى، وكتابة أمثلة.
- استخدم Markdown دائماً: عناوين، قوائم، وكتل كود بلغة محددة (\`\`\`ts, \`\`\`bash ...).
- أجب باللغة التي يستخدمها المستخدم (عربية أو إنجليزية).
- كن مختصراً ومباشراً. عند اقتراح خطة، رقّم الخطوات.`;

type ChatBody = { messages?: UIMessage[] };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as ChatBody;
        if (!Array.isArray(messages) || messages.length === 0) {
          return new Response("messages required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        try {
          const gateway = createLovableAiGatewayProvider(key);
          const model = gateway("google/gemini-3-flash-preview");
          const result = streamText({
            model,
            system: SYSTEM_PROMPT,
            messages: await convertToModelMessages(messages),
          });
          return result.toUIMessageStreamResponse({ originalMessages: messages });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "AI error";
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});