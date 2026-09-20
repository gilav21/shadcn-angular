# Brief: make `sidebar` usable as a real app shell

**Repo:** `D:\Development\shadcd\shadcn-angular`
**Component:** `packages/components/ui/sidebar/`
**Raised by:** building a production app (Adhop) on the library; every item below
blocked or annoyed a real consumer.

You have no context from the conversation that produced this. Everything you
need is here. **Read `.claude/CLAUDE.md` first** — it is the contract for this
repo (dual-mode pattern, naming, file architecture, SonarQube gate, responsive
and touch rules, e2e workflow). This brief does not repeat it; it does not
override it either.

---

## Why this work exists

`ui-sidebar` is the most complete piece of chrome in the library and the natural
foundation for any application built on it. But assembling a normal app shell
with it currently requires the consumer to fork files and hand-roll behaviour
that every consumer needs. That is the signal that the gap is in the library,
not in the app.

**Standing rule this brief comes from:** when something generic is missing or
broken in a shadcn-angular component, it gets fixed *at the source*, not patched
downstream. A local fix is lost on the next `update`, helps nobody else, and
silently forks a component the CLI still believes it owns.

---

## Verified findings

All six were confirmed by reading the source, not inferred. File and line
references are accurate as of this brief.

### 1. `ui-sidebar-menu-link` cannot do router navigation — **bug**

`packages/components/ui/sidebar/sub/sidebar-menu-link.component.ts` renders a
plain `<a [href]>`. Its own JSDoc says:

> "This is a real anchor, not a router link — for in-app routing use
> `SidebarMenuButtonComponent` and navigate from its click, **or add
> `routerLink` to your own copy of this file**."

And on `isActive`:

> "Presentational only; nothing compares it against the active route."

A component whose documentation instructs consumers to fork it has the wrong
API. Every Angular application routes. The library's own demo works around this
by using `ui-sidebar-menu-button` with `(click)="navTo(...)"` instead — the
workaround is already load-bearing in-repo.

**Severity: highest.** This is the one that forces a fork.

### 2. Collapsed state does not persist — **bug/feature**

`sidebar.service.ts` holds plain in-memory signals:

```ts
isOpen = signal(true);
isCollapsed = signal(false);
isMobile = signal(false);
collapsible = signal(true);
```

No `localStorage`, no cookie, no input to seed initial state. The rail re-expands
on every page load. To a user that reads as the app forgetting their preference.

### 3. No nested menus, and no `sub`/`action`/`badge`/`skeleton`/`rail` — **feature**

`sub/` contains 14 components. The structure is flat one level:
`group → group-label + group-content → menu → menu-item → menu-button | menu-link`.

shadcn/ui React ships `SidebarMenuSub`, `SidebarMenuSubItem`,
`SidebarMenuSubButton`, `SidebarMenuAction`, `SidebarMenuBadge`,
`SidebarMenuSkeleton` and `SidebarRail`. **None exist here.** Anything past a
flat list — a team list, a grouped nav with counts, a row-level "…" action — has
to be composed by hand.

### 4. The mobile drawer reimplements `ui-sheet` — **refactor, judgement call**

`sidebar.component.ts` contains its own `fixed inset-0 z-40 bg-black/50` scrim,
Escape handling, Tab/Shift+Tab focus cycling, focus-first-element on open and
focus restore on close (lines ~30, ~99–140). `packages/components/ui/sheet/`
exists and does the same job.

The library now maintains two focus traps and two scrims. **Do not blindly
merge them** — the sidebar drawer may have constraints `sheet` does not model.
Investigate, then either reuse `sheet` or write down in the source *why* it
cannot be reused. Either outcome is acceptable; an undocumented duplicate is not.

### 5. Unthrottled resize, hardcoded breakpoint — **bug**

`sub/sidebar-provider.component.ts`:

```ts
'(window:resize)': 'onResize()',
// ...
const isMobile = 'window' in globalThis && globalThis.window.innerWidth < 768;
```

Fires on every resize frame with no throttle, and 768px is not configurable.
Prefer `matchMedia` with a change listener over a resize handler, and expose the
breakpoint as an input.

### 6. No dark-mode toggle ships — **feature, separate from sidebar**

`init` generates `.dark { … }` and `@custom-variant dark (&:is(.dark *))`, so the
mechanism is complete — but no `ThemeService` and no toggle component are in the
registry. Every consumer writes the same ten lines. The library's own demo has
them in `demo/src/app/app.ts` (`toggleTheme`, around line 353).

This is not a sidebar concern. Treat it as its own small component
(`theme-toggle`) or a lib service, and ship it separately from items 1–5.

---

## What to build

Work in this order; ship each as its own reviewable unit. **Stop and report
before starting item 3** — it is the largest and its API shape deserves a check
before the code exists.

| # | Item | Kind |
|---|---|---|
| 1 | `routerLink` / `routerLinkActive` support on `ui-sidebar-menu-link` | bug fix |
| 2 | Collapsed-state persistence, opt-out-able | feature |
| 3 | `sidebar-menu-sub` + `-action`, `-badge`, `-skeleton`, `sidebar-rail` | feature |
| 4 | Resolve the drawer/sheet duplication (reuse or document) | refactor |
| 5 | Throttled resize + configurable breakpoint | bug fix |
| 6 | `theme-toggle` component or `ThemeService` | feature, separate |
| 7 | A `sidebar-layout` block | block, optional |

### Notes per item

**1 — router support.** Do not break the existing `href` API; this library is
pre-1.0 but `href` has legitimate uses (external links). Support both, and make
`isActive` derive from `routerLinkActive` when routing is used rather than
staying purely presentational. Removing the "fork this file" JSDoc is part of
the fix.

**2 — persistence.** Needs a storage key (so two sidebars on one origin do not
collide), an opt-out, and safety when `localStorage` throws — private windows and
blocked site-data both throw on access, and a sidebar must still render. Note the
provider already reads `window` defensively (`'window' in globalThis`); match
that posture.

**3 — nested menus.** The biggest item. Follow the dual-mode pattern in
`.claude/CLAUDE.md`: simple inputs for the common case, content projection for
full control. Check shadcn/ui React for API shape, but do not transliterate —
this library has its own conventions (signal inputs, `data-slot`, `class` input,
`cn()`).

**7 — the block.** `demo/src/app/app.html` is already a working app shell
(provider + sidebar + sticky header + inset + router-outlet). Promoting it to a
block would save every consumer the assembly. Optional, and only worth doing
after 1–3 land, since it should showcase the fixed API.

---

## Non-negotiables

These come from `.claude/CLAUDE.md`. Listed because they are easy to skip when
touching an existing component rather than writing a new one.

- **The SonarQube server scan is the done gate.** `npm run sonar:gate` against
  `localhost:9000`, zero new issues on changed files. eslint is not a
  substitute. If `SONAR_TOKEN`, Docker or the server is unavailable, the work is
  **blocked, not done** — say so and stop.
- **Registry**: new files must land in `packages/cli/src/registry/index.ts` via
  `sync-registry --fix`. Never hand-edit `files[]`. New components need registry
  entries, and `sidebar`'s `dependencies` may need updating.
- **Tests**: `sidebar.component.spec.ts` exists — extend it. Tests must verify
  behaviour, not construction. **Sabotage every new test**: break the behaviour
  it guards and confirm it goes red. Then ask whether the input is the general
  case or the one shape where the bug hides.
- **e2e**: `npm run e2e -- sidebar` must pass. New components get
  `npm run e2e:scaffold -- <name>`.
- **Stories and demo**: every component needs a Storybook story covering all
  options, and the demo page needs copy-paste-ready examples.
- **Responsive** 320px → 1920px, and **touch**: 44×44px targets, no
  hover-only or mouse-only interactions. Section 5 and 6 of CLAUDE.md.
- **Never `ViewEncapsulation.None`.**
- **A11y**: the existing focus trap and focus restore are real features. Do not
  regress them — and if you touch item 4, prove they still work with a test.

---

## How to verify

1. `npm run e2e -- sidebar` — proves a pristine consumer install still compiles
   and runs. This is the gate that catches registry and barrel mistakes.
2. **Router navigation for real**: a demo route where clicking a sidebar item
   navigates and the active item highlights from the *route*, not from a bound
   boolean. Assert computed style or geometry, not class strings — a `className`
   assertion passes while the page is visibly broken.
3. **Persistence**: collapse, reload, confirm it is still collapsed. Then
   simulate `localStorage` throwing and confirm the sidebar still renders.
4. **Resize**: confirm the breakpoint handler does not fire per frame.
5. **Screenshots at 320px and 1920px**, expanded and collapsed, light and dark.
   Verify what the browser shows, not what the DOM contains.
6. `npm run sonar:gate`, then confirm the *server* says clean — query
   `/api/qualitygates/project_status` for `OK` and
   `/api/issues/search?inNewCodePeriod=true` for `total: 0`. Exit code 0 is not
   a verdict; CLAUDE.md explains why.

---

## Scope

**In scope:** items 1–7 above, in `shadcn-angular` only.

**Out of scope:** anything in the consuming app. Do not open `D:\Development\adhop`.

**If you find more generic gaps while in there**, add them to this brief rather
than fixing them silently — the same rule that produced this document applies to
you.

**If you disagree with an item**, say so with evidence before building it. Item 4
in particular is a judgement call, and "documented why not" is a valid outcome.

---

## Findings added while executing this brief

Per the "If you find more generic gaps while in there" rule above.

### 8. The same routing gap exists in two sibling link components — **bug**

Item 1 fixed `ui-sidebar-menu-link`. Two other components have the identical
defect, each documenting it in their own JSDoc rather than supporting routing:

- `packages/components/ui/navigation-menu/sub/navigation-menu-link.component.ts`
  — "there is no `routerLink` support and clicking does not close the dropdown".
- `packages/components/ui/breadcrumb/sub/breadcrumb-link.component.ts`
  — "For client-side routing, project a `routerLink` anchor instead of using
  this component."

The fix applied to the sidebar transfers directly: branch the template on
whether `routerLink` was set, keep `href` for external links, derive the active
state from `routerLinkActive`. Two details cost real debugging time on the
sidebar and will recur, so they are recorded here:

- A component instantiates its content projection **once**. Two
  `<ng-content />` tags across `@if` branches leave the second anchor empty —
  capture the label in an `<ng-template>` and render it into whichever branch
  is live.
- `RouterLink` writes the `target` attribute itself, so `[attr.target]` on a
  routed anchor is silently overwritten; bind `RouterLink`'s own `target`
  input there (and it takes `string | undefined`, not `null`).

Not fixed here because this brief scoped item 1 to the sidebar.

### 9. `tsc -p tsconfig.json` does not typecheck demo templates — **tooling**

The `[target]="target() || null"` type error (`RouterLink.target` is
`string | undefined`) passed both `npx tsc --noEmit -p tsconfig.json` and the
full vitest run, and only surfaced when `ng serve`/`ng build` compiled the demo
app's templates. Anything that changes a component's template bindings needs a
demo build to be considered typechecked.

### 10. `variant="sidebar"` hardcodes `h-screen`, so an embedded sidebar overflows — **bug**

`SIDEBAR_VARIANT_CLASSES.sidebar` in `packages/components/ui/sidebar/sidebar.component.ts`
is `'h-screen border-e border-sidebar-border'`. Any sidebar rendered inside a
sized container — every demo page that shows one in a bordered box, and any app
embedding a sidebar in a panel rather than the page shell — is 100vh tall inside
that box and overflows it. Visible on `/sidebar` in the demo, where the last
group is cut off.

Found while adding item 3; pre-existing and unrelated to it, so not fixed here.
The fix is presumably `h-full` with the page shell supplying the height, but that
changes the layout of every existing consumer, so it wants its own decision.

### 11. Tailwind variants in library source are not always emitted — **tooling trap**

`ui-sidebar-rail` first shipped its hover affordance as
`group-hover:bg-sidebar-primary group-hover:opacity-100` plus
`group-focus-visible:*` on a child of a `group` parent. The classes were applied
to the element correctly, but the line never appeared.

Checked against the compiled CSS (`dist/demo/browser/styles.css`):

- `group-hover:opacity-100` **is** emitted — but only because other components
  (dock, toast, bento-grid, kanban, page-builder) already use it.
- `group-hover:bg-sidebar-primary` is **not** emitted — no `group-hover:*sidebar*`
  rule exists anywhere in the bundle.
- `group-focus-visible:` is **not** emitted at all — zero occurrences.

So a variant+utility combination that no other component already uses can
silently produce no CSS, and the component looks correct in source and in the
DOM while being invisible on screen. The rail is now driven from component
state (`hovered`/`focused` signals) instead, which also makes the affordance
assertable in a unit test.

Before relying on a variant like `group-hover:`/`group-focus-visible:` with a
theme colour, confirm the exact utility appears in the built CSS. The six other
components using `group-hover:` were checked and are fine.
