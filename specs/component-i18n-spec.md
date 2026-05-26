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
| 1 | Build `lib/i18n/` infrastructure (types, token, utils, common locales, tests) | done | 97 |
| 2 | Refactor `calendar` to use new infrastructure | done | 97 |
| 3 | Refactor `sortable` to use new infrastructure | done | 97 |
| 4 | Refactor `rich-text-editor` to use new infrastructure | done | 97 |
| 5 | New i18n: `pagination` | done | 99 |
| 6 | New i18n: `dialog`, `sheet`, `drawer`, `toast`, `alert-dialog` (bundle: simple "close"/"cancel"/"confirm") | done | 98 |
| 7 | New i18n: `command`, `combobox`, `autocomplete`, `select`, `phone-input`, `tree-select` (bundle: search inputs + no-results) | done | 97 |
| 8 | New i18n: `file-upload` | done | 98 |
| 9 | New i18n: `data-table` (split `DataTableLocale` from `CalendarLocale`) | done | 97 |
| 10 | New i18n: `carousel`, `tour` (stepper excluded — no built-in text) | done | 97 |
| 11 | New i18n: `breadcrumb`, `rating`, `code-block` (input-otp + tree excluded — no built-in default text) | done | 98 |
| 12 | New i18n: `color-picker`, `bar-race-chart`, `eyedropper`, `shortcut-bindings-dialog`, `comparison-slider`, `kanban` (empty + page-builder excluded — see notes) | done | 96 |
| 13 | Format-only components: `number-input`, `slider`, `progress`, `number-ticker` use `formatNumber()` with locale | done | 96 |
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
- **`CalendarLocale` lost its data-table fields (Task 9)**: the
  previously-optional `filterPlaceholder`, `columnsLabel`,
  `noResultsLabel`, `rowsPerPageLabel`, `pageLabel`, and `ofLabel`
  fields were removed from `CalendarLocale` and now live on the new
  `DataTableLocale` in `ui/data-table/data-table.locales.ts`.
  Consumers who built a custom `CalendarLocale` literal that
  populated any of those keys will hit a `TS2353` excess-property
  error after upgrading — move the entry into a custom
  `DataTableLocale` and bind it via `<ui-data-table [locale]="...">`.
- **`<ui-data-table>` locale input shape (Task 9)**: was
  `input("en")` (string, default `'en'`); now
  `input<LocaleInput<DataTableLocale>>()` (string | object,
  no eager default — falls through to `UI_LOCALE_ID`). Identical
  default behaviour for consumers that never set `[locale]`, but
  `dataTable.locale()` now returns `undefined` instead of `'en'`
  when unset.
- **`<ui-data-table-multiselect-filter>` placeholder input shape
  (Task 9)**: was `input('Search...')` (always `string`); now
  `input<string>()` (`string | undefined`). The rendered placeholder
  is unchanged for any consumer who reads it from the DOM —
  `resolvedPlaceholder()` carries the same English fallback chain.
  But code that programmatically reads
  `multiselectFilter.placeholder()` now sees `undefined` where it
  saw `'Search...'`.
- **`<ui-tour>` button-label input shapes (Task 10)**:
  `nextLabel`, `prevLabel`, `finishLabel`, `skipLabel` changed from
  `input<string>('Next' | 'Previous' | 'Done' | 'Skip')` (eager
  English defaults) to `input<string>()` (no default — template
  falls through to `t().next / t().previous / t().finish / t().skip`
  via nullish-coalescing). The rendered button text is unchanged for
  English consumers without `UI_LOCALE_ID`, but code reading
  `tour.nextLabel()` programmatically now sees `undefined` where it
  saw `'Next'`. Same class of change as the Task 9 multiselect
  placeholder.
- **`<ui-rating>` ariaLabel input shape (Task 11)**: was
  `input('Rating')` (always-string default); now `input<string>()`
  (`string | undefined`). The rendered `aria-label` is unchanged
  for English consumers without `UI_LOCALE_ID` — `resolvedAriaLabel()`
  carries the same English fallback chain. Code that reads
  `rating.ariaLabel()` programmatically now sees `undefined` where
  it saw `'Rating'`. Same class of change as Task 10's tour labels.
- **Task 10 stepper exclusion**: the spec originally listed
  `stepper` in the bundle (alongside `carousel` and `tour`), but
  `<ui-stepper>` and its sub-components have no built-in user-visible
  text — the template renders consumer-provided `step.title` /
  `step.description` and every sub-component slot is a pure
  `<ng-content />` projection. Same rationale class as `drawer` in
  Task 6 — correctly excluded from i18n.
- **Task 12 empty + page-builder**: `<ui-empty>` and its sub-components
  are pure `<ng-content />` projection slots — no built-in text. Excluded
  for the same reason class as drawer/stepper/tree. `<ui-page-builder>`
  is an admin-app internal tool with many strings spread across the
  main template and a `property-editor` sub-component (Layout,
  Settings, Props, Clear, Count, Width, None, …). Deferred as a
  follow-up task so Task 12's scope stays focused on the user-facing
  components.
- **`<ui-kanban>` locale input shape (Task 12)**: was
  `input<string | KanbanLocale>('en')` (eager English default,
  pre-existing KanbanLocale that did NOT extend LocaleMeta); now
  `input<LocaleInput<KanbanLocale>>()` (no eager default; KanbanLocale
  extends LocaleMeta with required `code` field and optional `rtl`).
  Same DOM behaviour for English consumers without `UI_LOCALE_ID`;
  consumers who built a fully-custom `KanbanLocale` literal must add
  `code: 'xx'` (the `rtl: boolean` requirement was relaxed to
  `rtl?: boolean`). Sub-components now also inherit via
  `provideComponentLocale` rather than the prior explicit
  `[locale]="resolvedLocale()"` binding chain (the chain still works
  — the broadcast just removes the need to thread it manually).
- **`<ui-eyedropper>` label input shape (Task 12)**: was
  `input('Pick color')` (always-string); now `input<string>()` with a
  new `resolvedLabel()` computed that falls through to
  `t().pickColor`. Code that reads `eyedropper.label()`
  programmatically now sees `undefined` where it saw `'Pick color'`.
  Same class of change as Task 9 multiselect / Task 10 tour / Task 11
  rating.
- **Task 11 input-otp + tree exclusions**: `<ui-input-otp>`'s
  `ariaLabel` is `input<string | undefined>(undefined)` with no
  built-in English default — entirely consumer-provided. `<ui-tree>`'s
  expand chevron is `aria-hidden="true"` (the parent `treeitem`
  already exposes `aria-expanded`); tree-item labels come from
  consumer `<ui-tree-label>` projection. Neither component ships
  user-visible English strings that need translation. Excluded for
  the same reason class as `stepper` / `drawer`.

### Known follow-ups still in i18n scope

- **Data-table aria-labels** (pre-existing English in `data-table.component.html`):
  `aria-label="Select row"` (line 69), `Collapse/Expand row` (114),
  `Row actions` (130), `Select all` (427), `Filter ' + col.header`
  (473/518/556), `Column menu for ' + col.header` (594),
  `Resize ' + col.header + ' column'` (614). These were never wired
  through `CalendarLocale` and remain hardcoded after Task 9.
  Localising them needs new `DataTableLocale` keys with `{column}`
  interpolation for the per-column variants. Tracked separately so
  Task 9's scope stays focused on the chrome that previously lived on
  `CalendarLocale`.
- **Resize math now follows the locale-derived `dir`**: the host
  `[attr.dir]="dir()"` added in Task 9 means column-resize delta math
  flips for any data-table with `locale="he"`/`"ar"` even on an
  ancestor LTR page. This is the intended behaviour (resize follows
  the rendered direction) but is a silent change from the pre-Task-9
  default where resize math always read the inherited DOM direction.

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
