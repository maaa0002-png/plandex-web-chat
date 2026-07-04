# Plandex Web Chat

واجهة دردشة ويب لمساعد برمجي ذكي، متجاوبة مع الهاتف والحاسوب.
مبنية على TanStack Start + React + Tailwind، وتستخدم Lovable AI Gateway.

## التطوير المحلي

```bash
bun install
bun run dev
```

ثم افتح http://localhost:8080

## المتغيرات المطلوبة

- `LOVABLE_API_KEY` — مفتاح Lovable AI (للـ backend فقط).

## النشر على Render

1. اربط هذا المستودع بـ Render (New → Web Service).
2. Render سيقرأ `render.yaml` تلقائياً.
3. أضف `LOVABLE_API_KEY` في Environment.
4. Deploy.

## البنية

- `src/routes/index.tsx` — الصفحة الرئيسية (الدردشة).
- `src/components/chat/ChatApp.tsx` — واجهة الدردشة.
- `src/routes/api/chat.ts` — نقطة نهاية البث (streaming).
- `src/lib/ai-gateway.server.ts` — مزود Lovable AI.

## الترخيص

MIT