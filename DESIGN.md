# API Key Manager — Design System (`DESIGN.md`)

A quiet, precision-crafted secrets-manager interface modeled on developer vault products (**Doppler**, **Infisical**, and **1Password**), built with zero-dependency vanilla CSS custom properties, full dark/light theme support, and native EN/FA RTL mirroring.

---

## 1. Design Principles

| Reference | Principle Adopted | Where It Lives |
|---|---|---|
| **Doppler** | Quiet layered dark slate/charcoal surfaces (no pure `#000`), single accent used sparingly, high-density monospace secrets table with masked values & status chips | `:root` tokens, `.keys-table-head`, `.key-row`, `.key-status` |
| **Infisical** | Search-first top bar, subtle per-provider brand accents (left border + tinted icon tile, never a rainbow), hover-revealed row actions, skeleton shimmer on load | `.top-bar`, `.provider-card[style*="--brand"]`, `.key-actions`, `.skeleton-card` |
| **1Password** | Calm, centered vault unlock composition with single focal password input; pinned/favorite items elevated as hero cards at the top; scannable brand-anchored cards | `.modal-vault-lock`, `.pinned-grid`, `.provider-card.is-pinned` |

---

## 2. Color Tokens

### Dark Theme (Default — `:root`)
| Token | Value | Role |
|---|---|---|
| `--bg` | `#0B0E14` | Base app canvas (deep slate, not pure black) |
| `--bg-glow` | `#121826` | Subtle top radial ambient glow |
| `--surface-1` | `#12161F` | Primary cards & panels |
| `--surface-2` | `#181D29` | Elevated modals & popovers |
| `--surface-3` | `#202736` | Secondary buttons, chips, hover fills |
| `--inset` | `#090C11` | Inputs, code blocks, secret value wells |
| `--line` | `#242B3A` | Subtle structural dividers |
| `--line-strong` | `#353F54` | Active borders & hover outlines |
| `--ink` | `#F1F5F9` | Primary text |
| `--ink-2` | `#94A3B8` | Secondary labels & metadata |
| `--ink-3` | `#64748B` | Muted hints & placeholders |
| `--accent` | `#E0B049` | Primary CTA & active focus ring |
| `--accent-strong` | `#EDC35E` | Primary CTA hover |
| `--on-accent` | `#1B1404` | Text on primary accent |
| `--ok` | `#10B981` | Active keys, unlocked vault, copy success |
| `--warn` | `#F59E0B` | Locked vault, expiring/revoked warnings |
| `--danger-bg` | `#DC2626` | Destructive CTA background |
| `--danger-text` | `#F87171` | Destructive hover/error text |

### Light Theme (`.theme-light`)
| Token | Value | Role |
|---|---|---|
| `--bg` | `#F6F7F9` | Base canvas |
| `--surface-1` | `#FFFFFF` | Cards |
| `--surface-2` | `#FFFFFF` | Modals |
| `--surface-3` | `#EEF1F6` | Secondary buttons & chips |
| `--inset` | `#F8FAFC` | Inputs & secret wells |
| `--line` | `#E2E8F0` | Dividers |
| `--line-strong` | `#CBD5E1` | Hover/input borders |
| `--ink` | `#0F172A` | Primary text |
| `--ink-2` | `#475569` | Secondary text |
| `--ink-3` | `#64748B` | Muted text |
| `--accent` | `#C68E1E` | Primary CTA |
| `--ok` | `#059669` | Success / active |
| `--warn` | `#D97706` | Warning / locked |
| `--danger-bg` | `#DC2626` | Destructive CTA |

### Per-Provider Brand Accents (`--brand`)
Applied via `style="--brand: <hex>"` on `.provider-card` and `.provider-detail-header` (using logical `border-inline-start` for automatic RTL mirroring):
- OpenAI: `#10A37F` · Anthropic: `#D97757` · Google AI: `#4285F4` · Groq: `#F55036` · DeepSeek: `#4D6BFE` · Mistral AI: `#FF7000` · OpenRouter: `#6366F1` · Together AI: `#0F6FFF` · Fireworks AI: `#8B5CF6` · Replicate: `#14B8A6` · Hugging Face: `#F59E0B` · Default: `#6366F1`

---

## 3. Typography & Spacing Scale

- **UI Font:** `'Inter', 'Vazirmatn', system-ui, -apple-system, sans-serif` (system fallback offline)
- **Monospace Font:** `'Source Code Pro', ui-monospace, 'Cascadia Mono', 'SFMono-Regular', monospace` (used for API keys, base URLs, model tags, and stats counters with `font-variant-numeric: tabular-nums`)
- **Type Scale:** `11px` (micro chips/table headers) · `12px` (mono URLs/keys) · `13.5px` (body/controls) · `15px` (card titles/modal headers) · `20px` (page heading)
- **Spacing Scale:** `4px` · `6px` · `8px` · `12px` · `16px` · `20px` · `24px`
- **Radii:** `--radius-sm: 6px` · `--radius: 8px` · `--radius-lg: 12px` · `--radius-xl: 16px`

---

## 4. Motion & Accessibility

- **Card Entrance Stagger:** `cardIn` (`220ms cubic-bezier(0.2, 0.8, 0.2, 1)`) staggered by `calc(var(--i, 0) * 28ms)`.
- **Modal Transitions:** `180ms` opacity fade + `translateY(10px) scale(0.985)` settle.
- **Copy Feedback:** `.copied` state flashes `--ok` border/color for `1200ms`.
- **Skeleton Shimmer:** `1.4s` linear gradient sweep while IndexedDB initializes.
- **Reduced Motion:** `@media (prefers-reduced-motion: reduce)` collapses all transitions and animations to `0.01ms`.
- **Touch & Keyboard:** Hover-revealed `.key-actions` remain visible on `:focus-within` and on `@media (hover: none), (pointer: coarse)`. All interactive elements preserve `2px solid var(--accent)` `:focus-visible` rings.
- **RTL:** All directional borders, paddings, and insets use CSS logical properties (`border-inline-start`, `inset-inline-end`, `padding-inline`).
