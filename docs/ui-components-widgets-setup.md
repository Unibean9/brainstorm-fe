# UI Components — Hướng dẫn setup đầy đủ (req-tool-fe)

Tài liệu mô tả **stack UI thực tế** của project và **danh mục đầy đủ** `components/ui/`. **Nguồn code chuẩn** là các file trong repo (`components/ui/*.tsx`, `app/globals.css`); không nhân đôi toàn bộ source vào đây để tránh lệch phiên bản.

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Dependencies](#2-dependencies)
3. [Cấu hình tooling](#3-cấu-hình-tooling)
4. [Theme & globals.css](#4-theme--globalscss)
5. [Tiện ích & alias](#5-tiện-ích--alias)
6. [Quy ước animation (Base UI)](#6-quy-ước-animation-base-ui)
7. [Quy ước kích thước control](#7-quy-ước-kích-thước-control)
8. [Thêm / cập nhật component (shadcn CLI)](#8-thêm--cập-nhật-component-shadcn-cli)
9. [Danh mục đầy đủ `components/ui`](#9-danh-mục-đầy-đủ-componentsui)
10. [Form: React Hook Form + Zod](#10-form-react-hook-form--zod)
11. [Bảng dữ liệu](#11-bảng-dữ-liệu)
12. [Dark mode cố định & Sonner](#12-dark-mode-cố-định--sonner)
13. [Checklist project mới](#13-checklist-project-mới)
14. [Phụ lục: Widget & Video (mẫu tham khảo)](#14-phụ-lục-widget--video-mẫu-tham-khảo)

---

## 1. Tổng quan kiến trúc

| Hạng mục | Công nghệ |
|----------|-----------|
| Framework | **Next.js 16** (App Router), **React 19** |
| Primitives UI | **@base-ui/react** — headless, accessible |
| Generator / preset | **shadcn** (package `shadcn`), style **`base-nova`** trong `components.json` |
| Styling | **Tailwind CSS v4** — **không** dùng `tailwind.config.ts`; theme trong `app/globals.css` (`@theme inline`) |
| Animation CSS | `tw-animate-css` + `shadcn/tailwind.css` (import trong globals) |
| Variants | **class-variance-authority (cva)** |
| Merge class | **clsx** + **tailwind-merge** (`cn()` trong `lib/utils.ts`) |
| Icons | **lucide-react** |
| Motion tùy chỗ | **framer-motion** (dùng khi cần, ví dụ demo; overlay/popup chuẩn dùng CSS + data attributes Base UI) |
| Theme | **Dark only** — class `dark` cố định trên `<html>`, palette 4 màu trong `globals.css` (không `next-themes`) |

**Số lượng file UI trong repo:** **47** file dưới `components/ui/` (xem bảng mục 9).

---

## 2. Dependencies

Các gói UI liên quan trực tiếp (tham chiếu `package.json`):

```json
{
  "@base-ui/react": "^1.4.1",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "tailwind-merge": "^3.6.0",
  "tailwindcss": "^4",
  "@tailwindcss/postcss": "^4",
  "tw-animate-css": "^1.4.0",
  "shadcn": "^4.7.0",
  "lucide-react": "^1.14.0",
  "sonner": "^2.0.7",
  "cmdk": "^1.1.1",
  "embla-carousel-react": "^8.6.0",
  "input-otp": "^1.4.2",
  "react-day-picker": "^10.0.0",
  "recharts": "^3.8.0",
  "vaul": "^1.1.2",
  "framer-motion": "^12.38.0",
  "@tanstack/react-table": "^8.21.3",
  "react-hook-form": "^7.75.0",
  "@hookform/resolvers": "^5.2.2",
  "zod": "^4.4.3",
  "date-fns": "^4.1.0"
}
```

---

## 3. Cấu hình tooling

### 3.1 PostCSS

**File:** `postcss.config.mjs`

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

### 3.2 shadcn / components.json

**File:** `components.json` (rút gọn ý chính):

- `style`: **`base-nova`**
- `tailwind.css`: **`app/globals.css`**
- `rsc`: `true`, `tsx`: `true`
- Aliases: `@/components`, `@/components/ui`, `@/lib`, `@/hooks`

Thêm component có sẵn trong registry:

```bash
npx shadcn@latest add <tên-component>
```

---

## 4. Theme & globals.css

**File:** `app/globals.css`

Khối bắt buộc tối thiểu (project đầy đủ hơn — xem file gốc):

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  /* map semantic colors → CSS variables */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  /* ... card, popover, border, radius-*, chart, sidebar ... */
}

:root {
  /* REQ-Bean9 brand + semantic light theme */
  --brand-pink: #f4449b;
  --brand-magenta: #ad1c9a;
  --brand-purple: #67178d;
  --brand-dark: #0a000e;
  --radius: 0.75rem;
  /* ... */
}

.dark {
  /* dark semantic tokens */
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground min-h-screen;
    /* optional: radial gradient — xem file gốc */
  }
  html.dark body {
    /* palette cố định — xem app/globals.css */
  }
}
```

---

## 5. Tiện ích & alias

### `lib/utils.ts`

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### `lib/utils/format-image-url.ts`

Chuẩn hóa URL ảnh (null-safe, hỗ trợ path tương đối `/...`). Được dùng bởi `SafeImage` và có thể import trực tiếp:

```typescript
import { formatImageUrl } from "@/lib/utils/format-image-url"
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

---

## 6. Quy ước animation (Base UI)

Popup / overlay từ **@base-ui/react** dùng các data attribute (không dùng `data-state=open` kiểu Radix):

| Attribute | Ý nghĩa |
|-----------|---------|
| `data-open` | Đang mở |
| `data-closed` | Đang đóng |
| `data-starting-style` | Giai đoạn **vào** (animate in) |
| `data-ending-style` | Giai đoạn **ra** (animate out) |

**Pattern CSS** (tham chiếu `dialog.tsx`, `sheet.tsx`, `select.tsx` — `Select` popup):

```text
transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]
data-starting-style:scale-95 data-starting-style:opacity-0
data-ending-style:scale-95 data-ending-style:opacity-0
data-open:scale-100 data-open:opacity-100
```

**Trigger Select:** Base UI đặt `data-popup-open` trên trigger; icon chevron có thể xoay với nhóm `group/select-trigger` + `group-data-[popup-open]/select-trigger:rotate-180`.

---

## 7. Quy ước kích thước control

Tham chiếu thiết kế “chuẩn form” trong project:

| Thành phần | Mặc định | Nhỏ |
|------------|----------|-----|
| **Button** | `h-10` `px-4` | `h-9` `px-3` |
| **Button icon** | `size-10` | `size-9` / `size-8` (icon-sm / icon-xs) |
| **Input** | `h-10` `px-3` `py-2` | — |
| **Select trigger** | `h-10` `w-full` | `h-9` (`size="sm"`) |
| **Textarea** | `min-h-[80px]` | — |
| **Tabs list** (ngang) | `h-10` | — |

**File liên quan:** `button.tsx`, `input.tsx`, `textarea.tsx`, `select.tsx`, `input-group.tsx`, `tabs.tsx`, `toggle.tsx`, `menubar.tsx`.

---

## 8. Thêm / cập nhật component shadcn CLI

1. Đảm bảo `components.json` trùng project đích.
2. Chạy `npx shadcn@latest add <id>`.
3. So sánh diff với theme REQ-Bean9 (màu, radius) trong `globals.css`.
4. Giữ **animation** theo pattern mục 6 nếu CLI sinh ra `animate-in` thuần mà không khớp Base UI.

---

## 9. Danh mục đầy đủ `components/ui`

| # | File | Mô tả ngắn | Export chính (named) |
|---|------|------------|----------------------|
| 1 | `accordion.tsx` | Mục thu gọn | Accordion, AccordionItem, AccordionTrigger, AccordionContent |
| 2 | `alert.tsx` | Thông báo inline | Alert, AlertTitle, AlertDescription, AlertAction |
| 3 | `alert-dialog.tsx` | Modal xác nhận | AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel, AlertDialogOverlay, AlertDialogPortal, AlertDialogMedia |
| 4 | `aspect-ratio.tsx` | Khung tỉ lệ | AspectRatio |
| 5 | `avatar.tsx` | Ảnh đại diện (+ group, badge) | Avatar, AvatarImage, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarBadge |
| 6 | `badge.tsx` | Nhãn trạng thái | Badge, badgeVariants |
| 7 | `breadcrumb.tsx` | Đường dẫn | Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator, BreadcrumbEllipsis |
| 8 | `button.tsx` | Nút | Button, buttonVariants |
| 9 | `calendar.tsx` | Lịch (react-day-picker) | Calendar, CalendarDayButton |
| 10 | `card.tsx` | Thẻ nội dung | Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent |
| 11 | `carousel.tsx` | Slider ảnh (Embla) | Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, useCarousel, type CarouselApi |
| 12 | `chart.tsx` | Biểu đồ (Recharts) | ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle, type ChartConfig |
| 13 | `checkbox.tsx` | Hộp chọn | Checkbox |
| 14 | `collapsible.tsx` | Khối thu gọn đơn | Collapsible, CollapsibleTrigger, CollapsibleContent |
| 15 | `command.tsx` | Palette lệnh (cmdk) | Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut, CommandSeparator |
| 16 | `context-menu.tsx` | Menu chuột phải | ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuCheckboxItem, ContextMenuRadioItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuShortcut, ContextMenuGroup, ContextMenuPortal, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuRadioGroup |
| 17 | `data-table.tsx` | Bảng + sort/filter/page (TanStack) | DataTable (function component) |
| 18 | `dialog.tsx` | Modal | Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose, DialogOverlay, DialogPortal |
| 19 | `drawer.tsx` | Ngăn kéo (Vaul) | Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerFooter, DrawerTitle, DrawerDescription, DrawerOverlay, DrawerPortal, DrawerClose |
| 20 | `dropdown-menu.tsx` | Menu xổ xuống | DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent |
| 21 | `field.tsx` | Bộ khối field (label, lỗi, legend) | Field, FieldLabel, FieldDescription, FieldError, FieldGroup, FieldLegend, FieldSeparator, FieldSet, FieldContent, FieldTitle |
| 22 | `hover-card.tsx` | Thẻ hover | HoverCard, HoverCardTrigger, HoverCardContent |
| 23 | `input.tsx` | Ô nhập | Input |
| 24 | `input-group.tsx` | Input + addon / nút | InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupInput, InputGroupTextarea |
| 25 | `input-otp.tsx` | OTP | InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator |
| 26 | `label.tsx` | Nhãn | Label |
| 27 | `menubar.tsx` | Thanh menu ứng dụng | Menubar, MenubarPortal, MenubarMenu, MenubarTrigger, MenubarContent, MenubarGroup, MenubarSeparator, MenubarLabel, MenubarItem, MenubarShortcut, MenubarCheckboxItem, MenubarRadioGroup, MenubarRadioItem, MenubarSub, MenubarSubTrigger, MenubarSubContent |
| 28 | `navigation-menu.tsx` | Menu điều hướng | NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuTrigger, NavigationMenuContent, NavigationMenuLink, NavigationMenuIndicator, NavigationMenuPositioner, navigationMenuTriggerStyle |
| 29 | `pagination.tsx` | Phân trang | Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis |
| 30 | `popover.tsx` | Popover | Popover, PopoverTrigger, PopoverContent, PopoverHeader, PopoverTitle, PopoverDescription |
| 31 | `progress.tsx` | Thanh tiến trình | Progress, ProgressTrack, ProgressIndicator, ProgressLabel, ProgressValue |
| 32 | `radio-group.tsx` | Chọn một | RadioGroup, RadioGroupItem |
| 33 | `scroll-area.tsx` | Vùng cuộn tùy biến | ScrollArea, ScrollBar |
| 34 | `safe-image.tsx` | Ảnh (next/image): `src` nullable, chuẩn hóa URL, fallback khi lỗi | SafeImage, type SafeImageProps |
| 35 | `select.tsx` | Chọn từ danh sách | Select (Root), SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectSeparator, SelectScrollUpButton, SelectScrollDownButton |
| 36 | `separator.tsx` | Đường kẻ | Separator |
| 37 | `sheet.tsx` | Panel trượt | Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription |
| 38 | `skeleton.tsx` | Placeholder | Skeleton |
| 39 | `slider.tsx` | Thanh trượt giá trị | Slider |
| 40 | `sonner.tsx` | Toast Sonner | Toaster |
| 41 | `switch.tsx` | Công tắc | Switch |
| 42 | `table.tsx` | Bảng HTML | Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption |
| 43 | `tabs.tsx` | Tab | Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants |
| 44 | `textarea.tsx` | Vùng nhập nhiều dòng | Textarea |
| 45 | `toggle.tsx` | Nút bật/tắt | Toggle, toggleVariants |
| 46 | `toggle-group.tsx` | Nhóm toggle | ToggleGroup, ToggleGroupItem |
| 47 | `tooltip.tsx` | Chú thích | Tooltip, TooltipTrigger, TooltipContent, TooltipProvider |

**Import mẫu:**

```typescript
import { Button } from "@/components/ui/button"
import { SafeImage } from "@/components/ui/safe-image"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
```

---

## 10. Form: React Hook Form + Zod

Project có **`@hookform/resolvers`** và **`zod`**, nhưng **không** có file `components/ui/form.tsx` kiểu shadcn cổ điển. Có thể:

- Dùng **`Field`** (`field.tsx`) kết hợp `Label`, `Input`, `FieldError`, v.v.
- Hoặc tự bọc `FormProvider` / `Controller` từ `react-hook-form`.

Chi tiết validation và schema: tham chiếu `docs/SETUP.md` và các form thực tế trong app.

---

## 11. Bảng dữ liệu

- Primitive: `table.tsx`.
- Ví dụ tích hợp TanStack: `data-table.tsx` (`DataTable` với sort, filter, pagination).

---

## 12. Dark mode cố định & Sonner

- **Không** dùng `next-themes` hay chuyển sáng/tối. `<html>` luôn có class **`dark`** (`app/layout.tsx`) để utility `dark:` hoạt động.
- Màu nền chính: **#091413**, **#285A48**, **#408A71**, **#B0E4CC** — khai báo trong `app/globals.css` (`:root` + `.dark` đồng bộ).
- **Toast:** `components/ui/sonner.tsx` export `Toaster`, `theme="dark"` cố định; mount trong `AppProviders`.

---

## 13. Checklist project mới

- [ ] `npm install` đủ dependency mục 2
- [ ] `postcss.config.mjs` + `app/globals.css` (Tailwind v4 + theme)
- [ ] `components.json` + `npx shadcn@latest add …` cho đủ component
- [ ] Copy `lib/utils.ts`, alias `@/*`
- [ ] Provider: `AppProviders` + Toaster (`components/providers/app-providers.tsx` / `app/layout.tsx`)
- [ ] Kiểm tra animation popup theo mục 6 sau mỗi lần add CLI

---

## 14. Phụ lục: Widget & Video (mẫu tham khảo)

Các pattern **không** nằm trong `components/ui/` cố định — có thể tạo trong `components/widget/` hoặc feature folder:

- **Xác nhận xóa / hành động nguy hiểm:** compose `AlertDialog`.
- **Popover giỏ hàng / thông báo:** `Popover` + `Button` + list.
- **Video HLS:** cài `hls.js` hoặc `@vidstack/react`; phần cấu hình player xem thêm tài liệu ngoài hoặc legacy snippet trong git history nếu cần.

---

_Cập nhật theo codebase `req-tool-fe` (Base UI + shadcn base-nova + Tailwind v4). Sửa tài liệu này khi thêm/xóa file trong `components/ui/`._
