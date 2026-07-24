# Product

## Register

brand

## Users

- **Facilitator / PM / BA** — người dẫn phiên brainstorm, cần công cụ quan sát nhóm và chọn kỹ thuật phù hợp thay vì chatbot sinh ý tưởng.
- **Participant** — thành viên nhóm trong workshop (product, design, engineering), đóng góp ý tưởng trong khi AI can thiệp vào *quá trình* tư duy.
- **Decision maker** — người cần Thinking Trace và output (brief, PRD…) sau phiên, không chỉ sticky note rời rạc.

Bối cảnh sử dụng: phòng họp, remote workshop, product discovery, strategy session — không phải chat 1-1 với AI.

## Product Purpose

**AI Brainstorm Room** là không gian brainstorm có **AI Facilitator** và **Thinking Orchestration Engine**: quan sát → phân tích → chẩn đoán → chọn thinking state → chọn technique → điều phối → ghi Thinking Trace → lặp lại.

Landing page (surface ưu tiên hiện tại) phải truyền tải rõ:

1. Đây **không** phải chatbot ý tưởng — AI điều phối *process*.
2. Brainstorm là **state machine** thích ứng, không workflow tuyến tính.
3. **Thinking Trace** là tài sản: biết ý tưởng đến từ đâu, vì sao được chọn.

Các trang app (`/rooms`, `/workspace`, auth…) sẽ bổ sung sau; landing là cửa ngõ giới thiệu và chuyển đổi.

## Brand Personality

**Ấm · Sống · Có chủ đích**

- Ấm như phòng workshop thật (giấy, sticky, ánh sáng tự nhiên).
- Sống nhờ graph và motion thể hiện engine đang “thở”.
- Có chủ đích: mỗi animation phục vụ hiểu orchestration loop, không trang trí rỗng.

Giọng copy: facilitator thông minh, tự tin, không hù học thuật; tiếng Việt là ngôn ngữ chính.

## Anti-references

- Chatbot UI generic (bubble chat, “Ask AI anything”).
- SaaS hero-metric template (3 số to + gradient + icon grid giống nhau).
- Cream/beige AI landing monoculture không gắn workshop.
- Sticky-note app cliché không có depth (chỉ board màu mà không trace).
- Editorial-magazine typography lane (Fraunces italic + mono labels + ruled grid).
- Graph trang trí ngẫu nhiên không map kiến trúc engine.
- Motion scatter: mọi section fade-in giống nhau.

## Design Principles

1. **Process over ideas** — UI và motion nhấn orchestration loop, không “AI sinh 100 ý tưởng”.
2. **Show the engine** — knowledge graph hero là bản đồ engine (Observer → … → Trace), không wallpaper.
3. **Workshop warmth** — palette sticky/coral/sky; cảm giác phòng brainstorm thật, không cold devtool.
4. **Scroll tells the story** — graph highlight đổi theo fold khi user scroll (hero → diagnose → facilitate → trace).
5. **Accessible motion** — `prefers-reduced-motion`: graph tĩnh + crossfade; không khóa nội dung sau animation.

## Accessibility & Inclusion

- WCAG 2.1 AA cho text và interactive trên landing.
- Reduced motion bắt buộc: static graph fallback, không autoplay loop gây chóng mặt.
- Graph không phải nguồn thông tin duy nhất — mỗi node có text tương ứng trong HTML tĩnh (SEO + screen reader).
- Tiếng Việt `lang="vi"`; heading hierarchy rõ cho từng section.

## Landing scope (phase 1)

| Section | Nội dung (từ concept) |
|---------|------------------------|
| Hero | Value prop + interactive FDG (~15–20 node) |
| Problem | Pain points §2 (groupthink, sticky rời rạc…) |
| Loop | OODA orchestration cycle |
| Engine | Kiến trúc §5 (Observer → Output Generator) |
| Techniques | Bảng technique → thinking mode §4 |
| Thinking Trace | Ví dụ trace §4.5 |
| CTA | Đăng ký / bắt đầu phiên (link placeholder) |

**Tech note:** `@jonobr1/force-directed-graph` + `three` — client-only (`dynamic`, `ssr: false`), hero + scroll-sync highlight.
