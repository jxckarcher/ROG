```md
# Design Research Memo for Claude Code — Glitch UI (ROG Ally)

## What Jack wants (non-negotiables)
- **macOS/iOS-like clarity**: minimal, restrained, “built-in” feel — not vibe-coded.
- **Cyberpunk accent**: subtle neon as *highlight*, not the whole UI.
- **Modular UI**: modules can be swapped/refined (Chat / Scheduler / Memory / Budget / Terminal / Git).
- **Touch + controller friendly** on a handheld (ROG Ally).

ROG Ally baseline display: **7" FHD 1920×1080, 16:9, 120Hz**. :contentReference[oaicite:0]{index=0}

---

## Quick critique of v0.1 (from screenshots)
What’s giving “AI UI” vibes:
- **Emoji nav** + chunky left rail reads toy-ish, not system-grade.
- **Overly flat + empty**: huge dead zones, weak information hierarchy.
- **One loud accent (teal)** used for big primary buttons — feels “template”.
- **Borders/boxes** feel arbitrary; no consistent spacing rhythm.

What to aim for:
- Fewer, better surfaces.
- Strong typographic hierarchy.
- Accent used *sparingly* (focus states, key CTAs, active module).
- Glass + depth used as structure, not decoration.

---

## Core spec references (use as “design law”)
- **Minimum hit target 44×44pt** for touch controls. :contentReference[oaicite:1]{index=1}  
- **System typography (San Francisco / SF Pro)** and typographic guidance. :contentReference[oaicite:2]{index=2}  
- **Materials / vibrancy / blur** guidance (how glass should behave). :contentReference[oaicite:3]{index=3}  
- **Dark mode contrast guidance** (aim ≥4.5:1; better 7:1 where possible). :contentReference[oaicite:4]{index=4}  
- **Windows/Fluent “Acrylic”** is a good reference analogue for tasteful translucency on Windows. :contentReference[oaicite:5]{index=5}  
- **Design tokens approach** (build a token system so theming stays sane). :contentReference[oaicite:6]{index=6}  

---

## Design system: tokens first (so it stays modular)
Implement tokens as CSS variables (or Tailwind tokens) and never hardcode random hex/px in components.

### Spacing (8pt rhythm, with 4pt sub-steps)
- `space-1: 4`
- `space-2: 8`
- `space-3: 12`
- `space-4: 16`
- `space-5: 24`
- `space-6: 32`
- `space-7: 48`

### Radii
- `r-sm: 10`
- `r-md: 14`
- `r-lg: 20`
- `r-xl: 28` (only for big panels)

### Typography (system-feel)
Use `font-family: system-ui` stack (Windows-friendly) but tune sizes/weights to feel macOS-like.
Apple suggests legible sizes; design tips mention text should be at least **11pt**. :contentReference[oaicite:7]{index=7}

Suggested scale (px):
- Caption: 12 / 16 line-height
- Body: 14 / 20
- Body strong: 14 / 20, weight +100
- Title: 18 / 24
- Headline: 22 / 28

### Iconography (ditch emoji)
- Use a single icon set with consistent stroke (e.g., Lucide/Phosphor at 1.5–2px).
- Keep icons **secondary** to labels; no emoji as primary nav.

### Contrast & accessibility
- Text contrast: **≥4.5:1** baseline, aim higher for small text; large text can be ≥3:1 but don’t rely on it. :contentReference[oaicite:8]{index=8}  
- Non-text UI components (borders, icons) should generally hit **≥3:1**. :contentReference[oaicite:9]{index=9}  

---

## Glass / “Cyber-macOS” material rules (how to avoid cringe)
Glass works when it supports hierarchy:
- **One** global background layer (dark, subtle gradient + noise).
- **One** primary “chrome” layer (sidebar + top bar) using blur/translucency.
- Content cards use **soft elevation**, not heavy outlines.

Apple materials/vibrancy: use subtle blending, avoid low-contrast foreground-on-blur failures. :contentReference[oaicite:10]{index=10}  
Fluent Acrylic: translucency should add depth + hierarchy, not reduce legibility. :contentReference[oaicite:11]{index=11}  

Practical spec:
- Blur: 16–28px (don’t go crazy)
- Card border: 1px with low alpha
- Shadow: large, soft, low opacity (avoid “CSS drop shadow” look)
- Add **1–2% noise** overlay to prevent banding and “cheap glass” vibe

Neon usage:
- Neon is for: active nav item, focused input ring, status pulse (connected), critical buttons.
- Neon is NOT for: whole buttons, whole card borders, backgrounds.

---

## Layout patterns (macOS-ish)
### Sidebar
- Fixed width: 240–280px on desktop; collapsible to icon-only.
- Sections: Core (Chat, Scheduler, Memory, Budget, Terminal), then Connection.
- Active item: subtle filled background + thin accent bar (left edge), not a giant glowing pill.

### Top bar
- Left: page title + optional subtitle
- Center/right: connection status (SSH / Tunnel / Gateway / Telegram), budget indicator, theme switch

Apple layout guidance includes adequate spacing; keep controls comfortably separated. :contentReference[oaicite:12]{index=12}  

### Chat (don’t leave it empty)
- Two-column: thread list (or “contexts”) + conversation
- Bottom composer: big, clean, single line + expand on demand
- Primary action: Send; secondary: attachments, voice (future)

---

## ROG Ally ergonomics (design like a handheld)
- Touch targets: **44×44pt minimum**. :contentReference[oaicite:13]{index=13}  
- Controller focus states: visible, consistent (accent ring + slight scale)
- Avoid dense tables; prefer cards + drill-down
- Prefer “quick actions” over nested settings

Given 7" 1080p, include a “handheld mode” density toggle:
- **Comfort**: bigger type + bigger controls
- **Compact**: more information for desk use :contentReference[oaicite:14]{index=14}  

---

## Git / Repo UX (make git feel like Drive, not Terminal)
Goal: simple repo switch + “sync” mental model.

### Repo Dashboard
- Repo list with status chips:
  - Clean / Dirty / Ahead / Behind
  - Last pull time
  - Current branch
- Actions:
  - **Clone/Add repo** (from URL or preset list)
  - **Pull** (one click)
  - **Commit & Push** (guided, with diff preview)
  - **Open folder** (local workspace)
  - **View docs** (markdown preview + file tree)

### Suggested repo categories (Jack’s)
- `ROG` (UI builds)
- `Homing-Heroes` (docs)
- `autonomous-projects`
- `collaborative-projects`
- + ability to add new repos (private/public)

Design rule:
- “Sync” should be a single primary button (pull) and a single “publish” flow (commit+push).
- Advanced git (rebase, cherry-pick) stays hidden behind “Advanced”.

---

## Visual language checklist (to avoid vibe-coded look)
- No emoji navigation
- No neon borders everywhere
- No random gradients
- No mismatched radii
- No 6 different shadow styles
- No “big teal rectangle buttons” unless it’s the only primary action on the screen

Instead:
- Consistent tokens
- Quiet surfaces
- One accent color + one danger color
- Typography doing the heavy lifting

---

## Implementation notes (practical for Claude Code)
- Build a **token package** first: `tokens.ts` + CSS variables.
- Component library: small set of primitives:
  - `Surface`, `Card`, `Button`, `IconButton`, `Input`, `Badge`, `Tabs`, `SplitView`, `ListRow`
- Then compose pages from primitives (no page-specific styling except layout).
- Theme engine:
  - Accent color picker → updates CSS vars
  - Light/dark (mostly dark) + “reduced neon” toggle
- Accessibility:
  - Contrast checks baked into theme presets (WCAG targets above)
  - Reduced motion mode :contentReference[oaicite:15]{index=15}  

---

## Concrete next deliverable for v0.2 UI
1) Replace emoji sidebar with icon set + macOS-like active state.
2) Add top bar with status + budget chip.
3) Chat becomes split view (contexts + conversation).
4) Scheduler uses card list + “New job” modal:
   - “In 20m” / “Tomorrow 09:00” presets
   - Always routes via `tgremind` backend helper
5) Repo module MVP: list repos + Pull button + file tree + markdown preview.

If you want one thing to obsess over: **tokens + restraint**. Everything else becomes easy.
```
