# Demo App i18n — Localize Every Demo Page

## Context

`packages/components/lib/i18n` already localizes strings *inside* shadcn-angular
library components (calendar months, pagination prev/next, dialog close button,
etc.). The header locale switcher in `demo/src/app/app.ts` correctly broadcasts
the active locale via `provideUiLocale(appLocale)` → `UI_LOCALE_ID`, and every
library component picks it up.

What does **not** localize today is the **demo app itself**. Each
`demo/src/app/demos/**/*.ts` file hardcodes its own English titles, section
headings, descriptions, button labels, and — critically — sample data (kanban
cards, data-table rows, chat messages, tour steps, etc.). On most pages the
dominant visible text is demo-app text, not library text, so switching
languages visibly flips `dir` and a few inner words but most of the page stays
in English. The locale switcher feels broken even though the library mechanism
is correct.

This spec localizes the demo app so a language switch changes everything on
screen: page chrome and the example data both flip together.

---

## Goal

Switching the global locale changes **every visible string** in the demo app:

- Sidebar category labels (`Inputs`, `Layout`, `Navigation`, …)
- Introduction page copy
- Every demo's page title, description, section headings, button labels
- Every demo's sample data (names, descriptions, mock content)

Component **API names** in the sidebar (`Calendar`, `Pagination`, `Data Table`,
…) **stay in English** — they're technical identifiers users look up in docs,
not UI copy.

All 10 locales currently offered by the switcher (`en he ar de fr es ja zh ru
pt`) are fully translated. Translations are author-written, not native-reviewed;
the goal is "feels real in each language", not certified L10N quality.

---

## Approach

Each demo gets a sibling locale file using the same conventions as the library
components. A demo component injects `UI_LOCALE_ID` indirectly via
`createLocaleBindings`, exposes a `t` signal, and binds every string and data
array through `t()`.

### Locale-file pattern

```ts
// demo/src/app/demos/inputs/calendar-demo.locales.ts
import type { LocaleMeta } from '../../../../../packages/components/lib/i18n';

export interface CalendarDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  sections: {
    single: string;
    range: string;
    multi: string;
    withSelectors: string;
    dateTime: string;
    // …
  };
}

export const CALENDAR_DEMO_LOCALES: Record<string, CalendarDemoLocale> = {
  en: { code: 'en', title: 'Calendar', description: '…', sections: { … } },
  he: { code: 'he', rtl: true, title: 'לוח שנה', description: '…', sections: { … } },
  ar: { code: 'ar', rtl: true, title: 'تقويم', description: '…', sections: { … } },
  de: { code: 'de', title: 'Kalender', description: '…', sections: { … } },
  // fr, es, ja, zh, ru, pt …
};
```

### Demo-component wiring

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { createLocaleBindings } from '../../../../../packages/components/lib/i18n';
import { CALENDAR_DEMO_LOCALES } from './calendar-demo.locales';

@Component({
  selector: 'app-calendar-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalendarComponent],
  template: `
    <section class="space-y-4">
      <h2 [id]="'calendar'" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>
      <div class="flex flex-wrap gap-8">
        <div class="space-y-2">
          <h3 class="font-medium">{{ t().sections.single }}</h3>
          <ui-calendar mode="single" class="rounded-md border shadow" />
        </div>
        …
      </div>
    </section>
  `,
})
export class CalendarDemoComponent {
  // No locale input — demos always follow the global UI_LOCALE_ID.
  // Passing `signal(undefined)` makes resolveLocale fall through to the
  // global signal on every change.
  protected readonly t = createLocaleBindings(
    signal<undefined>(undefined),
    CALENDAR_DEMO_LOCALES,
  ).t;
}
```

`createLocaleBindings` is already designed to react to `UI_LOCALE_ID` changes
when the input signal is empty. No new infrastructure needed.

### Sample-data localization

Demos that ship sample data (kanban, data-table, chat, tour, sortable, …) move
the data into the locale dict as a structured field, not loose constants:

```ts
export interface KanbanDemoLocale extends LocaleMeta {
  title: string;
  description: string;
  columns: ReadonlyArray<{ id: string; title: string }>;
  cards: ReadonlyArray<{ id: string; columnId: string; title: string; assignee: string }>;
}
```

`id` / `columnId` stay stable across locales so reactive state (which card is
selected, which column is dragged over) keeps working when the locale flips.

### Cultural localization rules

- **Person names:** use a culturally appropriate name per locale, not a
  transliteration. `John Doe` → `יוסי כהן` (he) / `محمد علي` (ar) / `Hans
  Müller` (de) / `Marie Dubois` (fr) / `Carlos García` (es) / `山田太郎` (ja)
  / `王伟` (zh) / `Иван Иванов` (ru) / `João Silva` (pt).
- **Product / project names:** translate the meaning. `Project Alpha` → `פרויקט
  אלפא`.
- **Email addresses, URLs, code samples, identifiers:** keep ASCII. Don't
  translate `user@example.com`, `https://…`, or code in `<ui-code-block>`.
- **Component API names in the sidebar:** stay English.

### Sidebar & introduction

The sidebar's category labels and the introduction page get a small shared
`demo/src/app/app.locales.ts` (analogous to a library `*.locales.ts`) so the
top-level chrome localizes too.

---

## Phasing

### Phase 1 — Pilot (this session)

Four demos spanning the shapes the rest of the app will follow:

1. **`introduction.component.ts`** — minimal, sets the pattern for chrome-only
   demos.
2. **`navigation/pagination-demo.component.ts`** — small, page-chrome-only
   strings, no sample data.
3. **`inputs/calendar-demo.component.ts`** — many section headings, no sample
   data, shape covers the "input-heavy" demos.
4. **`patterns/kanban-demo.component.ts`** — heavy structured sample data
   (cards, columns, assignees), covers the "data-driven" demos.

Plus the shared `app.locales.ts` for the sidebar + introduction chrome.

The pilot also adds one Vitest spec per pilot demo:

```ts
it('localizes via UI_LOCALE_ID', () => {
  TestBed.configureTestingModule({ providers: [provideUiLocale('he')] });
  const fixture = TestBed.createComponent(CalendarDemoComponent);
  fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('לוח שנה');
});
```

The pilot passes a review-gate check (≥95) per the project's standing rule,
then waits for user approval before Phase 2.

### Phase 2 — Parallel rollout

After Phase 1 approval, one parallel subagent per remaining demo (~76
subagents) in worktree isolation. Each subagent:

1. Reads its demo's source.
2. Authors `<name>-demo.locales.ts` covering every visible string and every
   piece of sample data, all 10 locales, cultural names.
3. Rewrites the demo to bind via `t()`.
4. Adds the smoke spec.
5. Runs its own review gate ≥95.
6. Commits and reports back.

The controller harvests gate-passed commits and merges them into the working
branch.

### Phase 3 — Lint & polish

- A small Node script under `scripts/` greps `demo/src/app/demos/**` for
  string-literal text inside Angular template tags and reports any that aren't
  bound through `t()`. Run in CI. Allowlist for genuine non-translated
  content (`user@example.com`, CSS classes, etc.).
- Localize the page `<title>` updates in `AppComponent`'s `NavigationEnd`
  subscription (currently hardcodes `' - shadcn-angular'`).

---

## Non-goals

- Storybook stories. Stories stay English — they're contributor-facing and the
  effort doesn't pay off there.
- E2E specs under `e2e/harness/**`. The harness apps install one component at
  a time and test the library, not the demo app.
- Library unit-test/spec strings. Those test fixtures, not user-facing copy.
- Component API names in the sidebar.
- Native-reviewed translation quality. Author-written translations are
  acceptable; corrections welcome as follow-up PRs.
- Date/number/currency formatting beyond what the library already provides
  (Intl.* is already wired through the existing i18n helpers).

---

## Risks

- **Translation drift.** If a demo gets a new string post-rollout, the
  contributor only adds it to `en` and the other 9 fall back. Mitigation:
  Phase 3 lint catches the missing-key case at the type level (TypeScript
  already enforces the dict shape per locale).
- **RTL-flipped layouts in demos that depend on `start`/`end` Tailwind
  utilities.** Verified per pilot demo; expand checks to the rollout.
- **Sample-data `id` stability.** Mitigated by keeping `id` stable across
  locales (see "Sample-data localization" above).
- **Bundle size.** Each demo file gains ~5-15 KB of strings × 10 locales.
  Demos are lazy-loaded per route, so per-page impact is modest, and the
  effect is contained to the demo bundle (the library bundle is unchanged).

---

## Acceptance criteria

- Switching the header language picker visibly changes every string on the
  currently-viewed demo page, including sample data, in all 10 locales.
- The sidebar's category labels and the introduction page localize.
- Every demo has a smoke spec that asserts at least one non-English string
  renders under `provideUiLocale('he')`.
- `npm run build:demo` succeeds with zero warnings.
- `npm run test-visual` passes.
- Phase 3 lint script reports zero unlocalized template literals in
  `demo/src/app/demos/**`.
