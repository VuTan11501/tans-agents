# Copilot instructions — Tan's Agent

> Đọc file này trước khi sửa bất cứ thứ gì. Dự án có nhiều quy ước cụ thể vì đã trải qua 5 wave triển khai song song bằng sub-agents.

## Tổng quan

- **Stack**: Next.js 15 (App Router, Edge runtime) + React 19 + TypeScript + Tailwind + shadcn/ui + AI SDK v4 (`ai`, `@ai-sdk/google`, `@ai-sdk/groq`, `@ai-sdk/openai`).
- **Triết lý**: 100% free hosting. Production = Vercel, staging = Hugging Face Space (`Tan115/tans-agents-ui`), source = GitHub `VuTan11501/tans-agents`.
- **Provider mặc định**: 3 nhà (Google Gemini, Groq, GitHub Models) – tất cả đều free tier. Người dùng có thể tự cắm key qua dialog BYOK (header → nút Key).
- **Ngôn ngữ UI**: Tiếng Việt là mặc định. Khi viết string mới (label, toast, placeholder) → tiếng Việt.

## Cấu trúc thư mục

```
app/
  api/chat/route.ts        ← endpoint chính, dùng AI SDK data-stream protocol (toDataStreamResponse)
  api/chat-sse/route.ts    ← endpoint SSE thuần OpenAI-compatible (text/event-stream)
  api/share/route.ts       ← in-memory share store (7 ngày TTL)
  share/[id]/page.tsx      ← chat read-only public
  stats/page.tsx           ← analytics dashboard (SVG charts, đọc localStorage)
  sse-test/page.tsx        ← demo /api/chat-sse
  page.tsx, layout.tsx
components/
  chat.tsx                 ← orchestrator (useChat + state cho persona, memory, file upload, BYOK…)
  composer.tsx             ← input + slash commands + paperclip + mic + token badge
  message.tsx              ← bubble + copy/retry/tts/edit-branch/continue buttons
  sidebar.tsx              ← chat history (pin/tags/FTS/export/share/tool-toggle)
  header.tsx               ← model picker + PersonaPicker + Brain/Library/Bug/Key icons
  ui/                      ← shadcn primitives
  *-dialog.tsx             ← memory, prompt-library, error-log, api-keys, shortcuts, etc.
hooks/
  use-chat-history.ts      ← CRUD localStorage `tans-agents:sessions` (pin/tags/branches)
  use-typewriter.ts        ← adaptive 60fps rAF (ref: Code/docs/js/ai-agent.js lines 493-600)
  use-sse-chat.ts          ← parser SSE OpenAI format
  use-memory.ts, use-prompts.ts, use-user-keys.ts, use-voice.ts, use-hotkeys.ts, use-analytics-tracker.ts
lib/
  providers.ts             ← danh sách models theo provider + default
  tools.ts                 ← 7 agent tools + export agentTools, TOOL_NAMES
  personas.ts, system-prompt.ts, slash.ts, tokens.ts, export.ts, upload.ts,
  user-keys.ts, analytics.ts, error-log.ts
```

## Quy tắc khi sửa code

### 1. Streaming
- Endpoint **chính** `/api/chat` dùng `result.toDataStreamResponse()` (AI SDK protocol). Đừng đổi sang SSE thuần – `useChat` hook phụ thuộc nó.
- Endpoint **SSE thuần** `/api/chat-sse` dành cho tích hợp với client OpenAI-compatible (bao gồm hook `useSseChat`).
- Khi thêm field vào body request, **bổ sung CẢ HAI** route để tránh drift.
- `hooks/use-typewriter.ts` dùng thuật toán adaptive (`remaining>800 → ceil/30`, `>200 → 5`, …). Không đổi sang `charsPerSecond` constant – đã thử và streaming sẽ "giật".

### 2. Tools (`lib/tools.ts`)
- Mỗi tool xuất qua named export + được gom vào `agentTools = { … }` + auto-derive `TOOL_NAMES`.
- `webSearch` **không** dùng DuckDuckGo Instant Answer API (luôn rỗng). Dùng HTML scrape `https://html.duckduckgo.com/html/` với POST + User-Agent.
- `executeImage` dùng Pollinations.ai (no key). Brave Search opt-in qua `BRAVE_SEARCH_API_KEY`.
- Khi thêm tool mới: chạy `node scripts/test-tools.mjs` để verify mọi model còn tool-calling được.
- **Models không hỗ trợ tool-calling** (đã loại): `Meta-Llama-3.1-8B-Instruct`, `Meta-Llama-3.1-405B-Instruct` (GitHub Models). Đừng add lại.

### 3. Persona + memory + system prompt
- Persona được inject **client-side** vào messages: khi `messages.length === 0`, `chat.tsx` prepend `{role:"system", content: buildSystemPrompt({persona, memory})}` trước user message đầu tiên.
- Cũng gửi qua body (`personaSystemPrompt`) cho `/api/chat-sse` (route đó override `system` param).
- **Không** sửa logic này khi thêm field mới – có thể phá branching/share.

### 4. ChatSession schema (`hooks/use-chat-history.ts`)
```ts
{ id, title, messages, provider, model,
  createdAt, updatedAt,
  pinned?, tags?, enabledTools?,
  parentId?, branches?, persona?, memory? }
```
- Khi thêm field, mặc định `undefined` = chưa set (không phải `null`). Persist code đã dùng `JSON.stringify` an toàn với undefined.
- Hàm CRUD đã có: `create, update, rename, duplicate, remove, togglePin, setTags, getBranchTree`. **Tái sử dụng**, đừng viết hàm trùng.

### 5. BYOK
- Client gửi `userKeys: { groq?, gemini?, github?, openrouter?, brave? }` trong body.
- Route đọc `userKeys`, ưu tiên hơn `process.env`. Mapping: `google → userKeys.gemini`, `groq → userKeys.groq`, `github → userKeys.github`.
- **Đừng log `userKeys`** ra console (đã từng có bug này).

### 6. UI

- shadcn/ui được customize ở `components/ui/`. Đừng `pnpm dlx shadcn add` đè – manual edit.
- Icons: chỉ dùng `lucide-react` (đừng mix Heroicons/Tabler).
- Toast: dự án **không** dùng `sonner`. Dùng pattern toast local trong `sidebar.tsx` hoặc `Tooltip` (xem `share-link` impl).
- Header có nhiều nút icon → đã thêm `flex-1 overflow-hidden` ở container center + truncate trên PersonaPicker. Khi thêm nút mới phải đảm bảo `shrink-0` để không phá layout.
- **Tái sử dụng UI**: trước khi viết một component picker / dropdown / form mới, **luôn check xem có sẵn component dùng được không** trong `components/`. Quy tắc:
  1. Nếu UI đã tồn tại ở 1 nơi (ví dụ model picker ở header), khi cần ở chỗ thứ 2 (AB compare, settings...) → **extract thành component shared** (`components/<name>-picker.tsx`) chứ không copy-paste hay viết version mới với `<select>` HTML thuần.
  2. Component shared phải hỗ trợ props tuỳ biến (showAuto, label, align, triggerClassName, userKeys...) thay vì hard-code cho 1 use-case.
  3. Khi mở rộng component shared (thêm tính năng như live discovery), cập nhật ở 1 chỗ → cả app hưởng lợi.
  4. Ví dụ chuẩn: `components/model-picker.tsx` được dùng bởi `header.tsx` (provider+model+Auto) và `ab-toggle.tsx` (chỉ model, có label).
- Persona label: max `88px` truncate.
- **Long text & error boxes**: bất kỳ container nào hiển thị message lỗi, URL dài, JSON, hoặc nội dung từ user/API đều phải:
  1. Dùng `<ScrollArea className="max-h-XX">` (`@/components/ui/scroll-area`) thay vì `overflow-auto` thuần khi cần giới hạn chiều cao + có scrollbar đẹp.
  2. Áp `break-words [overflow-wrap:anywhere]` (hoặc `whitespace-pre-wrap break-words`) lên text bên trong để URL/token dài tự xuống dòng — **không bao giờ** để text tràn ngang khỏi `border` của box.
  3. Tách phần header (label) ra ngoài ScrollArea để label luôn cố định, chỉ phần body cuộn.

### 7. Testing & build

- **Luôn** chạy build trước khi commit:
  ```powershell
  cd C:\Users\Admin\Desktop\tans-agents
  Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
  npm run build
  ```
- Build có warning `Using edge runtime on a page currently disables static generation` – **bỏ qua**, không phải lỗi.
- Khi sửa `lib/tools.ts`, chạy `node scripts/test-tools.mjs` để verify.
- Test SSE thật: mở `/sse-test`, DevTools → Network → response phải show `data: {…}\n\n` lines.

### 8. Git workflow

- Push GitHub trước, sau đó copy file đổi sang `C:\Users\Admin\hf-ui-deploy\` và push HF Space.
- Commit message Vietnamese OK; convention: `feat(scope): …`, `fix(scope): …`. Thêm trailer:
  ```
  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
  ```
- `git push` ở PowerShell sẽ in NativeCommandError lên stderr (cosmetic); push vẫn thành công. Check exit code thay vì stderr text.

### 9. Sub-agent collaboration

- Khi triển khai nhiều tính năng song song: **mỗi agent phải có allowlist file riêng** để tránh xung đột. Đã có sự cố `chat.tsx` bị 3 agent ghi đồng thời.
- Wave-pattern hiện tại: 3-5 agent/wave, mỗi agent ~5 phút.
- Kiểm tra agent xong qua `list_agents`, đọc qua `read_agent`, build orchestrator-side sau khi tất cả idle.

### 10. Local state keys

- `tans-agents:sessions` – chat history
- `tans-agents:memory` – about + facts
- `tans-agents:prompts` – prompt library
- `tans-agents:keys` – BYOK
- `tans-agents:errors` – error replay log (50 mục)
- `tans-agents:events` – analytics events (1000 mục)
- `tans-agents:theme` – next-themes

Khi thêm key mới: dùng prefix `tans-agents:` cho dễ debug & dễ clear.

## Những thứ ĐỪNG làm

- Đừng đổi `id` truyền vào `useChat({ id })` – sẽ phá AI SDK SWR cache khi switch session. Ta tự manage state qua `setMessages` + localStorage.
- Đừng tạo file `.md` mới trong repo cho note/planning (trừ README/copilot-instructions).
- Đừng commit `.env.local`. Đừng log secrets.
- Đừng thêm dependency UI (Material, Chakra, Mantine…). Tất cả UI phải Tailwind + shadcn.
- Đừng split `components/chat.tsx` thành nhiều file mà chưa hỏi – đã trải qua nhiều agent đồng thời sửa, cấu trúc hiện tại đang ổn định.

## Reference

- Adaptive typewriter & SSE parser ref: `Code/docs/js/ai-agent.js` (lines 493-600 typewriter, 982-1043 SSE).
- AI SDK v4 docs: https://sdk.vercel.ai/docs (chú ý: dự án đang dùng v4, KHÔNG nâng v5 vì breaking API).
- Vercel deploy: GitHub auto-deploy `main`. HF Space deploy: push `main` của `hf-ui-deploy`.
