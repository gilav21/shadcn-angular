# Component i18n Strategy — Library-Wide Plan

## Context

shadcn-angular today has **partial, inconsistent i18n**: only 3 components (`calendar`, `sortable`, `rich-text-editor`) accept a `locale` input, and each uses a slightly different shape. Roughly 30 other text-bearing components ship hardcoded English. RTL works at the CSS layer via Tailwind's `rtl:` modifiers but is never tied to a single source of truth.

This spec consolidates the per-component migration to a single **headless locale-object input** pattern — the same approach React-Aria, Radix UI, Mantine, and MUI v6+ use. Zero runtime dependencies, zero overhead when unused, full per-instance overridability, and consistent with the library's "code lives in YOUR project" philosophy.

---

## Approach: Headless Locale Inputs

Every text-bearing component accepts:

```typescript
locale = input<LocaleInput<XLocale>>();
```

Where `LocaleInput<T> = string | T` — consumers pass a registry key (`"he"`) OR a fully custom locale object. Components resolve via a shared `resolveLocale()` helper that also reads a global `UI_LOCALE_ID` injection token as fallback when no input is provided.

**Three usage modes:**

```typescript
// 1. Defaults to 'en'
<ui-pagination />

// 2. App-wide via provider
bootstrapApplication(App, { providers: [provideUiLocale(signal('he'))] });

// 3. Per-instance override
<ui-pagination locale="he" />
<ui-pagination [locale]="myCustomLocale" />
```

**RTL:** every locale object carries `rtl?: boolean`; components apply `[attr.dir]` based on it. Tailwind's `rtl:`/`ltr:` modifiers handle CSS layer.

---

## Architecture

### Infrastructure (`packages/components/lib/i18n/`)

```text
lib/i18n/
  index.ts                 # barrel
  i18n.types.ts            # LocaleMeta, LocaleInput<T>
  i18n.token.ts            # UI_LOCALE_ID InjectionToken + provideUiLocale()
  i18n.utils.ts            # resolveLocale(), interpolate(), formatDate/Number/List/RelativeTime
  common.locales.ts        # cross-cutting strings (close, cancel, confirm, search, noResults, previous, next)
```

### Per-component locale files

Each text-bearing component owns its dictionary:

```text
packages/components/ui/<name>/
  <name>.locales.ts        # XLocale interface + X_LOCALES registry
  <name>.component.ts      # imports + uses LocaleInput<XLocale>
  index.ts                 # re-exports interface + registry
```

### Standard component shape

```typescript
import { LocaleInput, resolveLocale } from '../../lib/i18n';
import { PAGINATION_LOCALES, PaginationLocale } from './pagination.locales';

@Component({ /* ... */ })
export class PaginationComponent {
  readonly locale = input<LocaleInput<PaginationLocale>>();
  protected readonly t = computed(() => resolveLocale(this.locale(), PAGINATION_LOCALES));
  protected readonly rtl = computed(() => this.t().rtl === true);
}
```

### Supported locales (initial)

Match calendar's coverage: **en, he, ar, de, fr, es, ja, zh, ru, pt** (10 languages). Components need full coverage for **en, he, ar, de, fr, es, ja** (7); others fall back to English per-component as we fill them in. `resolveLocale` handles missing keys gracefully.

---

## Task Plan

Each task has a review-gate score recorded after completion. **Required: ≥95.**

| # | Task | Status | Score |
|---|------|--------|-------|
| 1 | Build `lib/i18n/` infrastructure (types, token, utils, common locales, tests) | done | 96 |
| 2 | Refactor `calendar` to use new infrastructure | done | 96 |
| 3 | Refactor `sortable` to use new infrastructure | done | 96 |
| 4 | Refactor `rich-text-editor` to use new infrastructure | done | 96 |
| 5 | New i18n: `pagination` | done | 96 |
| 6 | New i18n: `dialog`, `sheet`, `drawer`, `toast`, `alert-dialog` (bundle: simple "close"/"cancel"/"confirm") | done | 96 |
| 7 | New i18n: `command`, `combobox`, `autocomplete`, `select`, `phone-input`, `tree-select` (bundle: search inputs + no-results) | done | 96 |
| 8 | New i18n: `file-upload` | done | 96 |
| 9 | New i18n: `data-table` (split `DataTableLocale` from `CalendarLocale`) | pending | — |
| 10 | New i18n: `carousel`, `stepper`, `tour` (bundle: stepper-like navigation) | pending | — |
| 11 | New i18n: `breadcrumb`, `rating`, `input-otp`, `tree`, `code-block` (bundle: aria-label-heavy) | pending | — |
| 12 | New i18n: `color-picker`, `bar-race-chart`, `eyedropper`, `page-builder`, `shortcut-bindings-dialog`, `empty`, `comparison-slider`, `kanban` (bundle: remaining text-bearing) | pending | — |
| 13 | Format-only components: `number-input`, `slider`, `progress`, `number-ticker` use `formatNumber()` with locale | pending | — |
| 14 | Demo locale switcher (global `provideUiLocale` + UI to flip across the demo app) | pending | — |

### Breaking-change notes for consumers

- Every locale dictionary now **requires a `code` field** (BCP-47 string)
  via the `LocaleMeta` base interface. The pre-existing `CalendarLocale`
  shape did NOT include `code`; consumers who supplied a fully-custom
  `CalendarLocale` literal (without `code`) before this migration will see
  `TS2741: Property 'code' is missing` after upgrading. Add `code: 'xx'`
  (matching the registry key) to fix.
- Components that previously defaulted `locale = input<string>('en')`
  (currently only `calendar`) now have `locale = input<LocaleInput<T>>()`
  with no eager default. The end-state is identical when no global
  `UI_LOCALE_ID` is configured (still resolves to `'en'`), but apps that
  set `provideUiLocale('he')` at the root will now have their calendars
  render in Hebrew automatically — previously calendars without an
  explicit `locale` input stayed English.
- **Placeholder text standardisation (Task 7)**: `<ui-select>` and
  `<ui-tree-select>` default placeholders changed from `'Select an
  option'` and `'Select an item'` respectively to `'Select...'` —
  aligned with `<ui-autocomplete>` and the upstream shadcn/ui
  convention. Consumers who depended on the longer text can pass
  `[placeholder]="'Select an option'"` to restore it.

### Known follow-ups inside i18n scope

- **Parent → child locale propagation for compound components.** Today
  each sub-component (e.g. `<ui-pagination-previous>`) resolves its own
  locale via per-instance input or `UI_LOCALE_ID`. When a consumer writes
  `<ui-pagination locale="he"><ui-pagination-previous /></ui-pagination>`,
  the parent nav localizes but the children stay English. Workaround
  today: use `provideUiLocale` globally OR set `locale` on each child.
  Better future fix: have each compound parent re-broadcast its `locale`
  via `viewProviders: [provideComponentLocale(forwardRef(() => Cmp))]`
  so descendants inherit automatically. The contract is pinned by a
  test in `pagination.component.spec.ts` so the limitation does not
  silently change.

### Known follow-ups (out of i18n scope)

- **`e2e/orchestrator/impact.ts:114`** uses `path.basename(file)` for libFile
  lookup. Any libFile stored with a subdirectory prefix (e.g.
  `parsers/xlsx.ts`, `i18n/i18n.token.ts`) is silently truncated to its
  basename, so the impact analyzer cannot map subdirectory edits back to
  the components that consume them. Pre-existing bug; affects the new
  `lib/i18n/` tree the same way it already affects `lib/parsers/`. Tracked
  as a separate task — fix in a dedicated infra PR.

### Excluded (no built-in text)

`aspect-ratio`, `avatar`, `badge`, `blur-fade`, `card`, `chat`, `collapsible`, `context-menu`, `dock`, `dropdown-menu`, `emoji-picker`, `field`, `flip-text`, `gradient-text`, `hover-card`, `icon`, `kbd`, `label`, `marquee`, `menubar`, `meteors`, `morphing-text`, `navigation-menu`, `particles`, `popover`, `radio-group`, `resizable`, `scroll-area`, `scroll-progress`, `separator`, `skeleton`, `speed-dial`, `sparkles`, `split-button`, `stagger-children`, `streaming-text`, `table`, `tabs`, `text-reveal`, `timeline`, `toggle`, `toggle-group`, `tooltip`, `typing-animation`, `virtual-scroll`, `wobble-card`, `word-rotate`, all `*.directive.ts`.

---

## Review-gate rubric (per task)

The "score ≥ 95" gate is **not** a vibe. Each task is scored against the
ten dimensions below (10 points each, max 100). The gate is checked
**before commit** — if the reviewer reports < 95, the implementation
loops (fix → re-review) until it clears. The final committed score is
recorded on the task row above.

| # | Dimension | What gets full marks |
|---|---|---|
| 1 | Correctness (current state) | No known bugs in the merged code — reviewer returns `[]` or only flags out-of-scope items. |
| 2 | Reviewer findings addressed | Every CONFIRMED/PLAUSIBLE finding from the gate either fixed or explicitly deferred with a written reason. |
| 3 | Test coverage of new paths | Default-en, per-instance locale, global `UI_LOCALE_ID` fallback, custom locale object, RTL flip — all pinned by tests. |
| 4 | Architecture fit | Uses `createLocaleSelector` / `createLocaleBindings` / `interpolate` from `lib/i18n`. Per-component locale file when the dict is component-specific; `CommonLocale` for cross-cutting strings. |
| 5 | RTL handled | `[attr.dir]="dir()"` on the appropriate root (returns `'rtl' \| null` so ancestor `<html dir="rtl">` keeps working). Tailwind `rtl:` variants effective. |
| 6 | Translation quality | All 10 locales present and idiomatic for the dimension I can verify; flagged honestly when I can't. |
| 7 | Backward compatibility | Existing public API still compiles for consumers; default English text matches the pre-i18n hardcoded value (or the change is explicitly documented as a deliberate UX standardisation). |
| 8 | Docs / spec | Spec table row updated; commit message captures what changed and why. |
| 9 | Lint / type-check clean | `tsc --noEmit` is zero errors **for the whole project**, not just the touched files. |
| 10 | Reviewer surfaces nothing new on re-pass | After fixes, a second review pass finds no new defects beyond known-follow-ups. |
