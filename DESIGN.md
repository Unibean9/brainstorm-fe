---
name: AI Brainstorm Room
description: Landing workshop ấm — Thinking Orchestration Engine với knowledge graph hero
colors:
  canvas: "#faf7f2"
  sticky: "#fde047"
  coral: "#ea580c"
  sky: "#0ea5e9"
  ink: "#334155"
  foreground: "#1c1917"
  muted-fg: "#78716c"
  border: "#e7e0d5"
  card: "#ffffff"
typography:
  display:
    fontFamily: "Quicksand, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 5.5vw, 4rem)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Open Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
  label:
    fontFamily: "Open Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.08em"
rounded:
  sm: "calc(0.75rem - 4px)"
  md: "calc(0.75rem - 2px)"
  lg: "0.75rem"
spacing:
  section: "clamp(4rem, 10vw, 7rem)"
  block: "clamp(1.5rem, 4vw, 2.5rem)"
components:
  button-primary:
    backgroundColor: "{colors.coral}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "0.625rem 1.5rem"
  button-primary-hover:
    backgroundColor: "#c2410c"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "0.625rem 1.5rem"
---

<!-- SEED + SCAN: tokens từ app/globals.css; landing motion/graph bổ sung dưới -->

## Overview

Visual system cho **AI Brainstorm Room** landing: workshop ấm (canvas `#faf7f2`, sticky `#fde047`, coral `#ea580c`), hero **force-directed knowledge graph** đồng bộ scroll. Register **brand** — design là sản phẩm tại landing; app surfaces sau sẽ kế thừa token nhưng có thể dense hơn.

**Color strategy:** Committed warm — coral primary trên nền canvas, accent sticky cho highlight graph node, sky cho secondary/links.

**Hero graph:** [`@jonobr1/force-directed-graph`](https://github.com/jonobr1/force-directed-graph) — 15–20 node, 2D mode, labels cho engine components. Scroll sections set `pinStrength` / highlight node group qua Intersection Observer.

## Colors

| Role | Token | Hex | Use |
|------|-------|-----|-----|
| Canvas | `--brand-canvas` | `#faf7f2` | Page bg, workshop paper |
| Sticky | `--brand-sticky` | `#fde047` | Graph accent nodes, highlights |
| Coral | `--brand-coral` / `--primary` | `#ea580c` | CTA, primary actions, active graph node |
| Sky | `--brand-sky` | `#0ea5e9` | Links, secondary emphasis |
| Ink | `--brand-ink` | `#334155` | Graph labels, diagram text |
| Muted text | `--muted-foreground` | `#78716c` | Body secondary — verify ≥4.5:1 on canvas |

Gradient bg: dual radial (sticky top-left, sky top-right) — đã có trong `globals.css`.

Graph node colors (FDG): Observer `#ea580c`, Analyzer `#0ea5e9`, Diagnosis `#a855f7`, State `#22c55e`, Technique `#fde047`, Trace `#334155`.

## Typography

- **Display / UI:** Quicksand (`--font-quicksand`) — headings, buttons, nav.
- **Prose:** Open Sans (`--font-open-sans`) — body, descriptions.
- Hero H1: `clamp(2.25rem, 5.5vw, 4rem)`, `text-wrap: balance`, letter-spacing ≥ `-0.03em`.
- Không dùng eyebrow uppercase mọi section — tối đa 1 kicker toàn page.

## Elevation

- Cards: white `#ffffff` trên canvas, `ring-1 ring-foreground/10`, không nested cards.
- Graph canvas: subtle shadow `0 24px 80px -20px color-mix(in srgb, var(--brand-ink) 12%, transparent)`.
- Modal/overlay landing: dùng shadcn Dialog nếu cần demo — không glassmorphism mặc định.

## Components

### Knowledge graph hero (`components/widget/orchestration-graph.tsx`)

- Client-only: `next/dynamic`, `ssr: false`.
- Deps: `three`, `@jonobr1/force-directed-graph`.
- Data schema (d3-compatible):

```ts
nodes: { id, label, color?, isStatic? }[]
links: { source, target }[]
```

- Default graph: hub `orchestrator` + 8 engines (§5 concept) + 6 techniques (§4.3) — ~15 node.
- Scroll sync: mỗi `<section data-graph-focus="diagnosis">` → highlight node group + tăng `pinStrength` cho subgraph.
- Reduced motion: render static SVG fallback cùng topology.

### Motion stack

- **FDG:** continuous physics (GPU).
- **Scroll:** GSAP ScrollTrigger hoặc `motion` `useScroll` — section reveal, graph focus (không animate layout properties nặng).
- **Page load:** orchestrated sequence — graph fade in → headline → CTA (stagger ≤400ms total perceived).
- Easing: ease-out-quart/quint; `prefers-reduced-motion: reduce` → instant/crossfade.

### shadcn / Base UI

- Triggers: luôn `render={<Button />}` — không nest button.
- `DropdownMenuLabel` trong `DropdownMenuGroup`.

## Do's and Don'ts

**Do**

- Map graph nodes 1:1 với engine architecture trong concept doc.
- Giữ HTML tĩnh cho SEO mỗi section (graph là enhancement).
- Test graph trên mobile — giảm node count hoặc static fallback.

**Don't**

- Random particle graph không semantic.
- Dark-only landing (user chọn workshop warm light).
- Fade-in identical cho mọi section.
- SSR Three.js / FDG (hydration crash).
