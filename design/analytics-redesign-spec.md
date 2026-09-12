# Analytics Page Redesign — Implementation Spec

> Companion to `web-redesign-brief.md`. That file owns the **design system** (tokens, type scale,
> spacing). This file owns the **Analytics page** specifically, plus the cross-page hierarchy fixes.
> Where the two disagree, `web-redesign-brief.md` wins on tokens; this file wins on Analytics layout.

Stack: Next.js 14 App Router · Tailwind (CSS-variable tokens) · Recharts 2.12 · Zustand · next-intl-style
custom `useLocale()`. RTL (Arabic) is a first-class requirement, not an afterthought.

---

## 1. Review findings — what is wrong today

These are the concrete problems the redesign has to solve. Each is verified against current source.

### 1.1 Every page opens with the same 4–5 stat-card grid

`app/page.tsx:293`, `app/analytics/page.tsx` (period metrics), `app/clients/page.tsx:194`,
`app/transactions/page.tsx:230` all render
`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4` full of `<StatCard>`.

Four pages, one opening move. Nothing tells the eye which page it is on, and nothing on any page
says "this is the important number." This is the "SaaS-card kit" look the brief calls out.

**Fix:** give each page one hero element and demote the rest.
- **Overview** — hero is the KPI row. Keep it prominent; make the first card (Net Profit) span
  2 columns with a larger figure. The rest of the page goes quiet.
- **Analytics** — hero is the 12-month revenue trend chart. The KPI row above it becomes a
  compact, borderless metric strip (see §3.1), not four more cards.
- **Clients / Transactions / Subscriptions** — the table/list is the hero. Collapse their stat
  grids into a single-line summary bar.

### 1.2 One elevation, one radius, everywhere

Every surface is `bg-surface border border-border rounded-lg` (`Card.tsx`). `--shadow-md` is only
applied on hover, `--shadow-lg` only on modals. So the entire page is visually flat and uniform —
nothing recedes, nothing advances.

**Fix — three deliberate tiers:**

| Tier | Use | Treatment |
|------|-----|-----------|
| **Raised** | Exactly one hero block per page | `bg-surface-elevated` + `shadow-md` + `rounded-xl` |
| **Base** | Ordinary content cards | `bg-surface` + `border-border` + `rounded-lg`, **no shadow** |
| **Flush** | Metric strips, inline groups, table shells | no border, no bg — separated by `border-t`/dividers only |

Add a `tier` prop to `Card`: `'raised' | 'base' | 'flush'`, defaulting to `'base'` so existing
call sites are unchanged.

### 1.3 The "year" period is a calendar year, so January is a cliff

`getPeriodRange('year')` returns Jan 1 → Dec 31 **of the current year**. A freelancer opening
Analytics in February sees a 12-column chart with 10 empty columns and a "yearly" revenue figure
that is really six weeks of data. There is no rolling window anywhere in the page.

**Fix:** the hero trend chart is **trailing 12 months** (rolling), independent of the period filter.
The period filter drives the KPI strip and the breakdown panels, not the trend chart.

### 1.4 The all-time summary is an eight-box data dump

The bottom `SummaryBox` grid puts eight numbers at identical weight with a 1px-gap hairline grid.
No ranking, no relationship, nothing scannable.

**Fix:** cut to the four that answer a real question (Total Revenue, Net Profit, Avg Revenue/Client,
Monthly Tool Burden) and render them as a **flush** strip with `border-t` dividers. Drop the rest —
they are already visible elsewhere on the page.

### 1.5 No `prefers-reduced-motion` anywhere

`globals.css` defines `--dur-fast/base/slow` and three keyframe animations, but there is **no**
`@media (prefers-reduced-motion: reduce)` block in the stylesheet. Recharts also animates by default.
This is a straight accessibility failure.

**Fix:** add the global reduce block (§5.2) **and** gate Recharts `isAnimationActive` on it.

### 1.6 Missing from Analytics entirely

- No custom date range — only week/month/year presets.
- No trailing-12-month view (see §1.3).
- No export.
- No Pending Payments anywhere (the new feature).
- Category breakdown reads raw enum IDs through a local `formatEnumLabel` that title-cases
  `categoryId`. There is already a shared `lib/enumLabels.ts` — use it, and make it translatable.
  Right now an Arabic user sees `Tools`, `Client`, `Software` in Latin script.

### 1.7 What is already good — do not "fix" it

- Token architecture (CSS vars → Tailwind theme) is solid. **Keep it. Do not introduce new hex
  values or a new palette.** The indigo-violet accent stays.
- `focus-visible` rings are correct (2px offset ring on `--accent`) and applied globally.
- Top-clients-by-revenue is drawn as **horizontal bars with % labels**, not a donut. This is more
  accessible than a donut (pie/donut is WCAG grade C — slices are distinguished by color alone).
  **Keep bars.** See §3.4 for how to satisfy the brief's "donut or bar" ask without regressing a11y.
- `dir`-aware layout, `latinTokenClass`, and `dir="ltr"` on numeric spans are already threaded
  through. Preserve every one of these when rewriting.

---

## 2. Design system deltas

No new colors. Two additions only:

```css
/* globals.css — add to :root and .dark */
--pending:        #F59E0B;  /* light */  /* dark: #FBBF24 */
--pending-tint:   #FFFBEB;  /* light */  /* dark: #2A2010 */
```

`--pending` is an **alias of `--warning`** on purpose: pending money is "attention", not "bad".
Register `pending` in `tailwind.config.js` alongside `warning`.

**Chart series order** (already in `web-redesign-brief.md`, restated because charts must match):

`--accent` `#6D5EFC` → `--positive` `#10B981` → `--warning` `#F59E0B` → `--info` `#0EA5E9`
→ `#F43F5E` → `#8B5CF6` → `#14B8A6`

Expose these as a `CHART_SERIES` array in `lib/chartTheme.ts` reading from `getComputedStyle` so
charts follow light/dark automatically. **Do not hardcode hex in chart components.**

**Density:** Analytics is a dense dashboard. Use the tight end of the spacing scale —
section gap `24px`, in-card gap `16px`, metric strip padding `12px 16px`.

---

## 3. Analytics page layout

Page max width stays `max-w-6xl mx-auto`. Vertical rhythm `gap-6`.

```
┌─────────────────────────────────────────────────────────────┐
│ H1 Analytics            [ Month ▾ ] [ Custom… ] [ Export ▾ ] │  ← §3.0
├─────────────────────────────────────────────────────────────┤
│  Revenue    Net Income    Pending     Expenses               │  ← §3.1 flush strip
│  $12,400    $8,150        $2,300 (3)  $4,250                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ███ REVENUE TREND — trailing 12 months ███  ← HERO        │  ← §3.2 raised
│   (area+line, draws in on load)                             │
│                                                             │
├──────────────────────────────┬──────────────────────────────┤
│  Income vs Expenses (bar)    │  Top 5 Clients (bars)        │  ← §3.3 / §3.4 base
├──────────────────────────────┴──────────────────────────────┤
│  Expense breakdown by category                              │  ← §3.5 base
├─────────────────────────────────────────────────────────────┤
│  Total Revenue │ Net Profit │ Avg/Client │ Tools/mo         │  ← §3.6 flush
└─────────────────────────────────────────────────────────────┘
```

### 3.0 Header + filter

Keep the existing `<Segmented>` for Month / Quarter / Year. **Add `quarter`** — the brief asks for
month/quarter/year/custom and `quarter` does not exist today. Drop `week` from Analytics (it belongs
on Overview; a week is too short to analyse).

`Custom…` opens a small popover with two native `<input type="date">` fields (start, end) and
Apply/Cancel. Native date inputs are keyboard- and screen-reader-accessible for free and localize
themselves — do not build a custom calendar.

Period type becomes:

```ts
type Period =
  | { kind: 'month' | 'quarter' | 'year' }
  | { kind: 'custom'; start: string; end: string };  // ISO yyyy-mm-dd
```

Persist the selection in `sessionStorage` so a filter survives navigation away and back.

**Export** — a `Menu` with "Export CSV" and "Export PDF".
- CSV: build client-side from the period rows. No new dependency.
- PDF: `pdf-lib` is **already a dependency** (used by invoices) — reuse it. If the existing invoice
  PDF helper can be generalized, do that rather than writing a second PDF path.
- Filename `analytics-{start}-to-{end}.csv`. Prefix CSV with `﻿` (BOM) so Excel reads Arabic
  correctly, and guard against CSV injection by prefixing any cell starting with `= + - @` with `'`.

### 3.1 KPI strip — flush, not cards

Four metrics in one flush row: `border-y border-border`, internal `divide-x divide-border`
(must be `divide-x` regardless of dir — Tailwind handles RTL via logical properties; verify).

Per metric: `t-caption text-text-muted` label, `t-h2 tnum` value, and a delta chip vs. the previous
equivalent period. Tone: Revenue `positive`, Net Income `positive`/`negative` by sign,
Pending `pending`, Expenses `negative`.

**Pending Payments** shows amount **and** count: `$2,300` with `3 awaiting` beneath. It is the one
metric that is clickable — it links to `/clients#pending`.

**Motion (the page's one deliberate transition):** the four values count up from 0 on mount,
~600ms, `ease-out`, staggered 60ms. Implement with a small `useCountUp(value)` hook that
**returns the final value immediately** when `prefers-reduced-motion: reduce` is set.
Nothing else on the page fades, rises, or staggers.

### 3.2 Revenue trend — the hero

The one **raised** element on the page. `tier="raised"`, `pad={28}`, `min-h-[340px]`.

- Recharts `<ComposedChart>`: `<Area>` with an `accent`→transparent vertical gradient at 20% opacity,
  plus a `<Line>` at `strokeWidth={2.5}` on top. Dots hidden, `activeDot` on hover.
- **Trailing 12 months, always** — `[today - 11 months, today]`, ignoring the period filter.
  Label the card "Trailing 12 months" so this is explicit.
- X axis: short month labels, localized. Y axis: compact currency (`makeCompactCurrencyFormatter`).
- Custom `<Tooltip>` styled with `--surface-elevated` + `--shadow-lg` + `--r-md`. Recharts' default
  tooltip ignores the token system.
- **RTL:** Recharts does not flip automatically. Set `reversed` on the XAxis when `dir === 'rtl'`,
  and set `orientation="right"` on the YAxis. Verify visually in Arabic — this is the single most
  likely thing to break.
- **Draw-in on load:** `isAnimationActive` with `animationDuration={800}`, `animationEasing="ease-out"`.
  Set `isAnimationActive={false}` when reduced motion is requested.
- Empty state: if all 12 months are zero, render a centered `EmptyState`, not an empty axis frame.

### 3.3 Income vs Expenses — grouped bar

`tier="base"`. Grouped (not stacked) `<BarChart>`: income `--positive`, expenses `--negative`,
`radius={[4,4,0,0]}`, `barGap={4}`. Buckets follow the **period filter**: month → weeks,
quarter → months, year → months, custom → auto (days if ≤ 31, else weeks, else months).

Legend is required — two swatches with labels. Do not rely on color alone: keep income bars to the
**left** of expense bars consistently so position also encodes meaning.

### 3.4 Top 5 clients

`tier="base"`. The brief says "donut or bar". **Use bars** — a donut distinguishes slices by color
alone and fails colorblind users (WCAG grade C).

Keep the existing pattern (rank number · avatar · name · amount · % progress bar) but cap at **5**
rows and add a "+N more" line showing the aggregate of the remainder. Each bar gets its own
`CHART_SERIES` color by rank so it reads as a chart, not a list.

If a donut is wanted later it must ship with a visible percentage data table beside it, per the
a11y fallback rule. Not in this pass.

### 3.5 Expense breakdown by category

`tier="base"`. Horizontal bars, sorted desc, showing amount + % of total expenses. Includes
subscriptions folded in as categories rather than the separate subscription panel that exists today —
that panel duplicates what the category chart already says. Remove it.

Category names must go through `lib/enumLabels.ts` and be translatable (§1.6). Never render a raw
`categoryId`.

### 3.6 Summary strip

Flush, four items, `border-t`: Total Revenue · Net Profit · Avg Revenue per Client ·
Monthly Tool Burden. All-time figures from `overview`. `t-h3` values, not `t-h2` — this is the
quietest thing on the page.

---

## 4. Responsive

| Breakpoint | KPI strip | Trend | Mid row | Category |
|---|---|---|---|---|
| `< 640px` | 2×2 grid, dividers become borders | `min-h-[240px]`, ≤6 X labels | stacked | stacked |
| `640–1024` | 4 across | full | stacked | full |
| `> 1024px` | 4 across | full | 2 columns | full |

Charts use `<ResponsiveContainer width="100%">` with an explicit pixel height — never a percentage
height, or the container collapses to 0 and the chart silently disappears.

On mobile the header filter row wraps; Export collapses to an icon button **with an `aria-label`**.
No horizontal page scroll at 375px.

---

## 5. Accessibility — non-negotiable

### 5.1 Charts
Every chart gets `role="img"` and an `aria-label` summarising the data in words
("Revenue trend, trailing 12 months, ranging from $0 to $12,400, trending up").
Each chart card offers a **"View as table"** disclosure rendering a real `<table>` of the same data.
This is how a screen-reader user reads a chart, and it is also the a11y fallback the chart rules
require for any proportional visualization.

### 5.2 Reduced motion
Add to `globals.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Expose a `usePrefersReducedMotion()` hook and thread it into every Recharts `isAnimationActive`
and into `useCountUp`. The CSS block alone does **not** stop Recharts — it animates via JS.

### 5.3 Other
- Contrast ≥ 4.5:1 for text, ≥ 3:1 for chart strokes and UI boundaries, in **both** themes.
- Segmented control: arrow-key navigable, `role="tablist"`/`role="tab"`, `aria-selected`.
- Every interactive element reachable by keyboard with the existing visible focus ring.
- Touch targets ≥ 44×44px — today's segmented buttons and icon buttons need checking.
- Tooltips are hover-only, so they may **never** be the sole carrier of a value. Every chart value
  is also reachable via the table disclosure.
- Icons: `lucide-react` only. No emoji as icons.

### 5.4 RTL
- Never use `ml-*`/`mr-*`/`left`/`right` in new code — logical properties or `ps-*`/`pe-*` only.
- Wrap every numeral, currency figure, and percentage in `dir="ltr"`.
- Use `latinTokenClass()` for user-entered names, as existing pages do.
- Recharts axes, legend order, and tooltip anchoring all need explicit RTL handling — see §3.2.

---

## 6. Definition of done

- [ ] `npm run build` clean; `npx tsc --noEmit` clean; `npm run lint:i18n` clean.
- [ ] No new user-facing string is hardcoded — every one added to **both** `messages/en.ts` and
      `messages/ar.ts`.
- [ ] Page verified at 375 / 768 / 1440 in light **and** dark, in English **and** Arabic.
- [ ] Verified with `prefers-reduced-motion: reduce` — nothing animates, all values still correct.
- [ ] Keyboard-only pass: every control reachable, focus always visible.
- [ ] Empty state (no transactions at all) renders cleanly on every panel.
- [ ] No new npm dependency.
