# Component Design Guidelines

> **For Human & AI Contributors**

This document defines how to build components in shadcn-angular.
Follow these patterns exactly for predictable, consistent contributions.

---

## Core Philosophy

> **"If you project content, you get full control.
> If you don't, you get sensible defaults."**

We escaped Angular Material because customization was a nightmare.
Our components must be:

- **Easy to start** — Simple inputs for common use cases
- **Easy to customize** — Content projection for full control
- **Easy to understand** — The source code lives in YOUR project

---

## The Pattern: Input Defaults with Content Projection Override

Every compound component should support TWO usage modes:

### Mode 1: Simple Mode (Input-Driven)

```html
<!-- Quick and easy for prototyping -->
<ui-timeline-item 
  title="Version 2.0 Released" 
  description="Major update with new features."
  time="January 2024"
  variant="success" />
```

### Mode 2: Custom Mode (Template-Driven)

```html
<!-- Full control for production -->
<ui-timeline-item>
  <ui-timeline-header>
    <my-custom-icon animating="true" />
    <ui-timeline-connector class="bg-gradient-to-b from-green-500 to-blue-500" />
  </ui-timeline-header>
  <ui-timeline-content>
    <h3 class="text-xl font-black text-purple-500">Custom Title</h3>
    <p>Anything you want here...</p>
    <ui-button size="sm">View Details</ui-button>
  </ui-timeline-content>
</ui-timeline-item>
```

---

## Implementation Pattern

### Step 1: Define Inputs for Simple Mode

```typescript
@Component({
  selector: 'ui-example-item',
  // ...
})
export class ExampleItemComponent implements AfterContentInit {
  // Simple mode inputs
  title = input<string>();
  description = input<string>();
  variant = input<'default' | 'primary'>('default');
  
  // ...
}
```

### Step 2: Detect Content Projection

```typescript
// Detect if custom content is projected
@ContentChild(ExampleHeaderComponent) customHeader?: ExampleHeaderComponent;
@ContentChild(ExampleContentComponent) customContent?: ExampleContentComponent;

// Signal to track if we should use simple mode
private _hasCustomContent = signal(false);
hasCustomContent = this._hasCustomContent.asReadonly();

ngAfterContentInit() {
  this._hasCustomContent.set(!!this.customHeader || !!this.customContent);
}
```

### Step 3: Template with Conditional Rendering

```typescript
template: `
  @if (hasCustomContent()) {
    <!-- Custom mode: just render projected content -->
    <ng-content />
  } @else {
    <!-- Simple mode: render default structure from inputs -->
    <ui-example-header>
      <ui-example-icon [variant]="variant()" />
    </ui-example-header>
    <ui-example-content>
      @if (title()) {
        <ui-example-title>{{ title() }}</ui-example-title>
      }
      @if (description()) {
        <ui-example-description>{{ description() }}</ui-example-description>
      }
    </ui-example-content>
    
    <!-- Also allow partial customization -->
    <ng-content />
  }
`
```

---

## Decision Tree: When to Apply This Pattern

```text
Is the component compound (has child components)?
├── NO → Use simple inputs only (Button, Badge, Input)
└── YES → Does it commonly need customization?
    ├── NO → Consider data-driven only (Pagination)
    └── YES → Apply the dual-mode pattern
        └── Examples: Timeline, Breadcrumb, Accordion, Tree
```

### Components That SHOULD Have Dual Mode

| Component | Simple Inputs | Custom Content |
| ---------- | ------------- | -------------- |
| Timeline | Title, description, time | Header, content |
| Breadcrumb | Items array | Breadcrumb item slots |
| Accordion | Title, content | Trigger, content |
| Tree | Data array | Tree item nested structure |
| Stepper | Steps array | Stepper item slots |

### Components That Should Remain Simple

| Component | Reason |
| ---------- | ------ |
| Button | Single element, no compound structure |
| Badge | Single element |
| Input | Single element with variants |
| Progress | Just needs `[value]` |
| Avatar | Already has good projection pattern |

---

## Naming Conventions

### Component Selectors

```text
ui-{component}              → Main container
ui-{component}-item         → Repeated item
ui-{component}-header       → Header section (for projection)
ui-{component}-content      → Content section (for projection)
ui-{component}-trigger      → Interactive trigger
ui-{component}-{part}       → Other semantic parts
```

### Input Names

```typescript
// Content inputs (for simple mode)
title = input<string>();
description = input<string>();
label = input<string>();
content = input<string>();

// Configuration inputs
variant = input<'default' | 'primary'>('default');
size = input<'sm' | 'md' | 'lg'>('md');
disabled = input<boolean>(false);

// Data-driven inputs
items = input<T[]>();          // For list components
data = input<T>();             // For single data object
options = input<Option[]>();   // For select-like components
```

### Class Input

**Every component MUST have a `class` input for styling extension:**

```typescript
class = input('');

classes = computed(() => cn(
  'base-classes here',
  this.class()
));
```

---

## Component File Architecture

> **Migration in progress.** The library is moving from flat files under
> `packages/components/ui/` to a one-folder-per-component layout. During the
> migration the flat and folder layouts coexist; the tooling
> (`sync-registry.ts`, `validate-registry.mjs`, the CLI) is backward-compatible
> with both. New and migrated components MUST follow the conventions below.
> See `specs/component-architecture-refactor-spec.md` for the phased plan.

### Layout conventions

- **One** component / directive / pipe per `.ts` file.
- **One folder per top-level component:** `packages/components/ui/<name>/`.
- The folder's **entry file** is `<name>.component.ts`.
- Each folder has a **barrel `index.ts`** re-exporting the component's public
  API (main component + any sub-components consumers use directly).
- **Sub-components live in `<name>/sub/`.** A file under a `sub/` directory is
  never its own registry entry — it belongs to the folder's component.
- **Trio:** `<name>.component.ts` + `<name>.component.html` + an *optional*
  `<name>.component.css`. The `.css` file is created **only when there is real
  CSS** — no empty placeholder files. Tailwind utility classes stay inline in
  the HTML; `.css` holds only real CSS rules.
- **Support files** (`<name>.types.ts`, `<name>.utils.ts`, services) live in
  the component folder.
- `<name>.component.spec.ts` and `<name>.stories.ts` move into the folder.
  A `.stories.ts` that defines demo/helper components is **not** split — it is
  test scaffolding, not shipped components; it moves into the folder unchanged.
- **Cross-component imports go through the barrel** — `from '../button'`, never
  a deep `from '../button/button.component'`. Deep imports break the sync's
  component-boundary detection; `sync-registry.ts` reports them as warnings.
- **Directives and pipes stay flat** directly under `ui/` — they are *not*
  folderized and get no barrel or trio.
- Registry `files[]` paths are **folder-prefixed**
  (`accordion/accordion.component.ts`) and regenerated by
  `sync-registry.ts --fix` — never hand-edited.
- Shared chart utilities live in `packages/components/lib/`, not in any single
  chart's folder.

### Target structure

```text
packages/components/ui/
  accordion/
    index.ts                       # barrel — public exports
    accordion.component.ts          # entry / main component
    accordion.component.html
    accordion.component.css         # only if it has real CSS
    accordion.component.spec.ts
    accordion.stories.ts
    sub/
      accordion-item.component.ts / .html
      accordion-trigger.component.ts / .html
      accordion-content.component.ts / .html
  button/
    index.ts
    button.component.ts / .html      # single component → no sub/
  ripple.directive.ts                # directives/pipes stay flat
```

---

## Anti-Patterns (What NOT to Do)

### ❌ Angular Material Style (Don't Do This)

```typescript
// BAD: Forcing developers to extend/override
@Component({
  encapsulation: ViewEncapsulation.None,  // DONT DO THIS
  // Deep component hierarchy that's hard to customize
})
```

**NEVER use `ViewEncapsulation.None`.** Component styles leak to the entire
application and break the rest of the library's encapsulation guarantees.
If you need to style an element outside the component's own DOM tree
(e.g., a `document.body` overlay, or a queried target element), do it via
inline styles applied imperatively in TypeScript — save the original
values on the element before mutating, and restore them on teardown. The
tour component (`packages/components/ui/tour.component.ts`) is the
reference implementation for this pattern.

### ❌ Only Data-Driven (Don't Do This)

```html
<!-- BAD: No way to customize individual items -->
<ui-timeline [items]="timelineData" />
<!-- What if I need a custom icon on just one item? -->
```

### ❌ Only Template-Driven (Don't Do This)

```html
<!-- BAD: Too verbose for simple cases -->
<ui-timeline-item>
  <ui-timeline-header>
    <ui-timeline-dot variant="success" />
    <ui-timeline-connector />
  </ui-timeline-header>
  <ui-timeline-content>
    <ui-timeline-title>Simple Title</ui-timeline-title>
  </ui-timeline-content>
</ui-timeline-item>
<!-- When all I needed was a title! -->
```

### ✅ The Right Way

```html
<!-- Simple case -->
<ui-timeline-item title="Simple Title" variant="success" />

<!-- Complex case - full control when needed -->
<ui-timeline-item>
  <ui-timeline-header>
    <my-animated-icon />
    <ui-timeline-connector class="animate-pulse" />
  </ui-timeline-header>
  <ui-timeline-content>
    <custom-timeline-card [data]="item" />
  </ui-timeline-content>
</ui-timeline-item>
```

---

## Quality Standards

### 1. Composition

- **Prefer Package Components**: When building compound components, prioritize
  using existing package components (e.g., `ui-button`, `ui-badge`) over native
  HTML elements. This ensures consistent styling, functionality, and
  accessibility.

### 2. Code Hygiene

- **No Non-JSDoc Comments**: Avoid implementation comments inside methods.
  Code should be self-documenting. Use JSDoc `/** ... */` only for public APIs
  (inputs, outputs, exported methods).
- **No Unused Declarations**: Remove all unused imports, variables,
  parameters, and types in TypeScript files and the
  `@Component({ imports: [...] })` array. The compiler enforces
  `noUnusedLocals` and `noUnusedParameters` — check for `ts(6133)`
  ("declared but its value is never read") errors before finishing any file.

### 3. Testing & Documentation

- **Meaningful Unit Tests**: Tests must verify actual functionality
  (interactions, state changes), not just component creation.
- **Storybook**: Every component must have a Storybook story showing all
  inputs/options.
- **Demo Page**: Create a rich demo page with unique variants and
  "copy-paste ready" examples for developers.

### 4. SonarQube Compliance (Zero Tolerance)

> **🔴 MANDATORY DONE GATE — non-negotiable.** Work is **NOT done** until the
> **full SonarQube server scan** has been run against the local server
> (`http://localhost:9000`) via `npm run sonar:gate` and **every** issue it
> reports on the changed code is fixed (zero new issues). This is a hard gate
> before declaring any task, plan, or PR complete — **eslint /
> `eslint-plugin-sonarjs` is NOT a substitute** (it catches a subset; the server
> adds cognitive-complexity S3776, duplication, and type-aware rules the plugin
> doesn't mirror).
>
> Two commands, one rule — coverage must be **true at the verdict**:
>
> - `npm run sonar` — scan only. Use it while iterating on issues: issue
>   detection never reads coverage, so its findings are complete. It warns
>   loudly when the coverage report it uploads was measured on a different tree.
> - `npm run sonar:gate` — the done-gate. Runs `npm run coverage` (both legs in
>   parallel, ~100s) unless the tree fingerprint in `coverage/.tree-hash` proves
>   the existing report already describes this exact tree, then scans. Never
>   declare done on `npm run sonar` alone.
>
> Required sequence before "done":
>
> 1. `npm run sonar:gate` — Dockerized `sonar-scanner-cli` against
>    `localhost:9000`, with coverage guaranteed current. Needs `SONAR_TOKEN` (in
>    `packages/.env`, root `.env`, or the environment) and Docker running. If
>    the token is missing, **STOP and ask the human for it** — do not declare
>    done on the eslint subset alone.
> 2. Open the project in SonarQube (`http://localhost:9000`, project
>    `shadcn-angular`), fix **all** new issues on the changed files, and re-scan
>    (`npm run sonar` while fixing, `npm run sonar:gate` for the final verdict)
>    until the changed code is clean. Only genuine false positives may be
>    excluded, and only via `sonar-project.properties` with a documented
>    rationale in `docs/sonarqube-accepted-findings.md` (never inline
>    `eslint-disable`, which ships into consumers' projects).
>
> If the scan cannot be run (no token / server / Docker), the task is **blocked,
> not done** — say so explicitly rather than claiming SonarQube compliance.

All code must pass SonarQube with **zero issues**. Apply these rules from the start:

#### TypeScript Strictness

- **No `any` types** — use proper generics or `unknown`
- **No unnecessary type assertions** (`as Type`) — only assert when the
  compiler genuinely can't infer the type (S4325)
- **Mark never-reassigned members `readonly`** — signals, computed, viewChild,
  arrow function properties, etc. (S2933)
- **Remove all unused imports, variables, parameters** (S1128, ts6133)
- **Merge duplicate imports** from the same module into one statement (S3863)
- **Extract repeated union types into type aliases** — if a union like
  `'sm' | 'md' | 'lg'` appears 3+ times, create a `type Size = 'sm' | 'md' |
  'lg'` (S4323)

#### Modern API Preferences

- **`Number.isNaN()`** over `isNaN()`, **`Number.isFinite()`** over
  `isFinite()`, **`Number.parseFloat()`** over `parseFloat()` (S7773)
- **`String.fromCodePoint()`** over `String.fromCharCode()`,
  **`.codePointAt()`** over `.charCodeAt()` (S7758)
- **`Math.hypot(dx, dy)`** over `Math.sqrt(dx*dx + dy*dy)` (S7769)
- **`structuredClone(obj)`** over `JSON.parse(JSON.stringify(obj))`
  (S7784)
- **`el.dataset.fooBar`** over `el.getAttribute('data-foo-bar')`
  / `el.setAttribute('data-foo-bar', ...)` /
  `el.hasAttribute('data-foo-bar')` (S7761)
- **`RegExp.exec(str)`** over `str.match(regex)` for single matches
  (S6594)
- **`.replaceAll()`** over `.replace()` with global regex flag `/g`
  (S7781)
- **`globalThis`** over `window` when accessing global scope (S7764)
- **`new Array(n)`** over `Array(n)` (S7723)
- **`Blob.text()`** over `FileReader.readAsText()` (S7756)
- **`\d`** over `[0-9]` in regex (S6353)

#### Cognitive Complexity (S3776 — max 15)

- **Keep functions under 15 cognitive complexity** — this is the most common
  SonarQube violation
- **Extract helper functions** for nested logic blocks
- **Use early returns** (guard clauses) to reduce nesting depth
- **Extract switch/case bodies** into separate named functions
- **Extract loop bodies** when they contain conditionals

#### Control Flow & Logic

- **No negated conditions in if/else** — flip the branches:
  `if (!x) { A } else { B }` → `if (x) { B } else { A }` (S7735)
- **No nested ternaries** — extract to variables or if/else (S3358)
- **No duplicate branch/case blocks** — merge identical branches with `||`
  or fall-through cases (S1871)
- **No redundant assignments** — don't re-assign a variable to the value it
  already holds (S4165)
- **No loop variable reassignment** — use `while` loops or restructure (S2310)
- **Use `for-of`** instead of index-based `for` when the index is only used
  for array access (S4138)
- **Use `else if`** instead of `if` as the only statement in an `else` block
  (S6660)
- **Always handle or comment catch blocks** — no empty `catch {}` (S2486)
- **Always provide initial value to `.reduce()`** (S6959)
- **No identical sub-expressions** in `||` or `&&` (S1764)
- **Avoid boolean parameters** that switch behavior — use separate methods
  instead (S2301)

#### Regex

- **No unnecessary escapes** in regex (S6535)
- **No duplicate characters** in character classes (S5869)
- **Use quantifiers** `{2}` instead of repeating characters (S6326)

---

## Checklist for New Components

Before submitting a component, verify:

- [ ] Has `class` input for style extension
- [ ] Uses `ChangeDetectionStrategy.OnPush`
- [ ] Uses `input()` and `computed()` (not decorators)
- [ ] Has `data-slot` attribute for testing/styling hooks
- [ ] If compound: supports both simple and custom modes
- [ ] If compound: uses existing package components (not raw HTML)
  where possible
- [ ] Accessibility: proper ARIA attributes and keyboard navigation
- [ ] RTL Support: verifies correct rendering in RTL mode
- [ ] Tests cover both usage modes and verify functionality
- [ ] Storybook covers all options/variants
- [ ] Demo page includes copy-paste examples
- [ ] No unused declarations (imports, variables, parameters, types) —
  no `ts(6133)` errors
- [ ] Strict typing (no `any`, handles `undefined`)
- [ ] **SonarQube server scan run** (`npm run sonar:gate` against
  `localhost:9000` — coverage re-measured unless the tree fingerprint proves it
  current) and **all** reported issues fixed — the mandatory DONE gate in
  Section 4. eslint alone does NOT satisfy this.
- [ ] SonarQube zero issues — all rules in Section 4 above are followed
- [ ] No cognitive complexity > 15 in any function
- [ ] All class members that aren't reassigned are `readonly`
- [ ] Uses modern APIs (`Number.isNaN`, `structuredClone`, `.dataset`, etc.)
- [ ] Responsive: works from 320px phone to ultrawide (see Section 5)
- [ ] Touch: all interactions work on touch-only devices (see Section 6)
- [ ] E2E coverage: `npm run e2e:scaffold -- <name>` and the resulting
  spec passes (see "E2E Authoring Workflow" below)

---

## E2E Authoring Workflow

Every component MUST have an e2e spec under `e2e/harness/<name>/`.
The suite installs each component into a pristine Angular app the
same way a consumer would, then drives Playwright at the result —
the gate between "unit tests pass" and "publish to npm". CI runs the
subset of specs each PR's diff touches (registry-driven impact
analysis); pushes to master run everything.

### Adding a new spec — one command

```bash
# After dropping the new component on disk:
npm run e2e:scaffold -- <name>
```

That's it. The scaffolder:

1. Resolves `<name>` in the CLI registry (runs
   `sync-registry --fix` first if the name isn't registered yet;
   suggests the nearest registry key via Levenshtein on a typo).
2. Refuses if `e2e/harness/<name>/` already exists.
3. Reads `packages/components/ui/<name>/index.ts` and writes:
   - `e2e/harness/<name>/<name>-demo.component.ts` — standalone
     Angular demo with every exported class imported and a
     `data-testid="<sub>"` on each sub-component element.
   - `e2e/harness/<name>/<name>.spec.ts` — passing smoke spec.

```bash
# Run it
npm run e2e -- <name>

# Extend e2e/harness/<name>/<name>.spec.ts with real assertions.
# The data-testids in the demo are pre-wired — just reference them.
```

### Do NOT manually edit `e2e/orchestrator/specs.ts` for new specs

Single-component specs are auto-discovered from
`e2e/harness/<name>/`. Editing `specs.ts` is only correct for:

- **Multi-component installs** (one harness exercises several
  components together): add an `EXPLICIT_SPECS` entry with
  `names: ['a', 'b', 'c']` and a `label`.
- **Non-default `initArgs`** (e.g. `init --prefix acme`): same
  shape, with the `initArgs` field.

The `names` list is read by both the runner (for `add a b c --yes`)
and the impact analyzer — no separate dependency map is maintained.

### Inspecting the registry

`npx shadcn-angular why <component>` prints what a component is made
of and what depends on it — use it when picking dependencies or
sizing a refactor's blast radius:

```bash
npx shadcn-angular why button
#   Files (3): button/button.component.html, …
#   Direct dependencies: ripple
#   Reverse dependents (18): bento-grid, calendar, chat, …
```

### Interactive modes for authoring

```bash
npm run e2e:headed -- <name>   # visible Chromium, autonomous
npm run e2e:ui     -- <name>   # Playwright UI Mode (timeline / time-travel)
npm run e2e:debug  -- <name>   # Playwright Inspector (step-through)
npm run e2e:reset              # restore fixture-app to pristine state
```

### What the e2e suite catches that unit tests can't

- Registry entries pointing at deleted source files.
- `npmDependencies` / `libFiles` missed in a refactor.
- `index.ts` barrels exporting a deleted sub-component.
- Templates that compile in the workspace-linked demo but fail in
  a plain consumer install (no workspace dedup).
- Selector / template-tag rewrites broken by the `--prefix` flag.
- AOT / optimizer failures `ng serve` hides.

If you're working on a refactor that spans components or touches
shared lib code (`packages/components/lib/`), run the impacted
subset locally before pushing:

```bash
npm run e2e:impact -- --base origin/master   # preview CI's decision
npm run e2e                                  # full suite locally (~7 min)
```

See `e2e/README.md` for the full pipeline, troubleshooting, and the
deliberate-regression recipe.

---

## When a CLI npm Publish Is Required

The CLI fetches the **live registry manifest and all component/lib source from
the git branch at runtime** — the npm package only carries CLI *logic* plus an
offline fallback snapshot. So most changes ship the moment they land on `master`,
with **no publish needed**. Verify the boundary against
`packages/cli/src/registry/load.ts` and `packages/cli/src/core/fetch.ts` before
asserting — do not guess.

How the runtime fetch works:

- At startup `loadRegistry()` fetches
  `…/{branch}/packages/components/registry.json` and overwrites the in-memory
  registry in place (`registry/load.ts`). The literal in
  `packages/cli/src/registry/index.ts` is **only an offline fallback**, so its
  regeneration by `sync-registry --fix` does **not** force a publish.
- Component files are fetched from `…/{branch}/packages/components/ui/<file>` and
  lib files from `…/lib/<file>` at install time (`core/fetch.ts`).

**Publish IS required only when the bundled CLI changes:**

1. **CLI logic / actions** — real code under `packages/cli/src/**` (commands,
   `core/`, `mcp/`, `utils/`, `registry/load.ts`, `utils/paths.ts`).
2. **The manifest *shape*** — the `ComponentDefinition` interface in
   `registry/index.ts` and the `isValidRegistryShape` validator in `load.ts`.
   If the JSON shape changes, already-installed CLIs can't parse the new
   `registry.json`.
3. **Utils baselines** — `registry/legacy-baselines.ts`, `core/baseline.ts`.

**Publish is NOT required for** (all served live from `master`):

- Registry **data** edits — adding/editing components, deps, `npmDependencies`,
  `files[]`, `libFiles[]` in `registry.json` (and the regenerated `index.ts`
  snapshot).
- Plain component / lib **source** edits under `packages/components/ui/**` and
  `packages/components/lib/**` — including brand-new component or lib files.
- Demo, stories, e2e harness, dev scripts (`scripts/**`) — never shipped in the
  CLI package.

So: a PR that only touches components, lib source, and `registry.json` goes live
on merge. Add a PR to the pending-releases memory **only** if it changes CLI
logic, the manifest schema, or utils baselines.

---

## 5. Responsive Design (Zero Tolerance)

Every component MUST render correctly across all viewport widths:
**320px → 375px → 640px → 768px → 1024px → 1920px+**. Desktop appearance
must not change — responsive rules only add mobile/tablet adaptations.

### Rules

#### No Hardcoded Pixel Widths Without Responsive Breakpoints

- **Never** use `w-[Npx]`, `min-w-[Npx]`, or `max-w-[Npx]` alone — always
  pair with responsive variants
- ❌ `w-[300px]` — breaks on 320px phones
- ✅ `w-full sm:w-[300px]` — full width on mobile, fixed on desktop
- ❌ `max-w-[420px]` — clips on small phones
- ✅ `max-w-[calc(100vw-2rem)] sm:max-w-[420px]` — viewport-aware

#### No Hardcoded Heights Without Responsive Scaling

- ❌ `h-[600px]` — too tall for mobile
- ✅ `h-[350px] sm:h-[450px] md:h-[600px]`
- ❌ `min-h-[150px]` — wastes mobile space
- ✅ `min-h-[100px] sm:min-h-[150px]`

#### Responsive Spacing

- ❌ `p-6` or `gap-6` alone on containers
- ✅ `p-4 sm:p-6` and `gap-4 sm:gap-6`
- Apply to: Card, Dialog, Sheet, Drawer, Empty, and any container with
  `p-6`+ or `gap-6`+

#### Flex Layouts Must Wrap

- ❌ `flex items-center justify-between` on toolbars/controls — overflows
  on mobile
- ✅ `flex flex-wrap items-center justify-between gap-2`

#### Overflow Protection for Popups/Overlays

- **Every** absolutely/fixed positioned element (popover, dropdown, menu,
  toast, nav content) MUST have `max-w-[calc(100vw-2rem)]` to prevent
  viewport overflow

#### Text Truncation

- Long text in constrained containers MUST use `truncate`, `line-clamp-N`,
  or `overflow-hidden`
- Chip/badge text: use responsive max-width
  `max-w-[120px] sm:max-w-[200px] truncate`

### Testing Viewports

Verify every component at: **320px**, **375px**, **640px**, **768px**,
**1024px**, **1920px**

---

## 6. Touch Device Compatibility (Zero Tolerance)

Every interactive component MUST work on touch-only devices (phones, tablets)
with no mouse or keyboard. Use the shared `touch.ts` utility
(`isTouchDevice()`, `onLongPress()`, `onDoubleTap()`) from `lib/touch.ts`.

### Touch Compatibility Rules

#### No Hover-Only Interactions

- If `(mouseenter)`/`(mouseleave)` reveals essential UI (buttons, menus,
  content), add a touch alternative
- ✅ Hover Card / Tooltip: tap to open, tap elsewhere to dismiss
- ✅ Navigation Menu / Menubar: tap to toggle submenus
- ✅ Dropdown submenu: tap to expand (not hover-only)
- CSS `opacity-0 group-hover:opacity-100` for essential controls → add
  `@media (hover: none) { opacity: 1 }` or always-visible on touch

#### No Mouse-Only Drag and Drop

- HTML5 drag events (`dragstart`, `dragover`, `drop`, `dragend`) do NOT work
  on mobile Safari/Chrome
- Every `(mousedown)` for dragging MUST have a matching `(touchstart)` with
  `touch-action: none`
- Every `(window:mousemove)/(window:mouseup)` MUST have
  `(window:touchmove)/(window:touchend)`
- Reference: `resizable.component.ts` and `slider.component.ts` already
  implement both correctly — follow their pattern

#### No Right-Click-Only Context Menus

- `(contextmenu)` requires right-click — unavailable on touch
- Add long-press (500ms touch hold) as alternative using `onLongPress()` from
  `lib/touch.ts`

#### No Double-Click-Only Actions

- `(dblclick)` doesn't work reliably on touch
- Add double-tap detection using `onDoubleTap()` from `lib/touch.ts`
- Data table inline editing is the primary case

#### Touch Target Sizing

- All interactive elements MUST be at least **44×44px** on touch devices
  (WCAG 2.5.8, Apple/Google HIG)
- The global `@media (pointer: coarse)` rule in `tailwind.css` enforces
  this as a baseline

#### No Keyboard-Shortcut-Only Features

- If a feature is only accessible via keyboard shortcut (Ctrl+C, Shift+Click
  range select, etc.), provide a touch alternative
- Add visible buttons/actions for touch users where keyboard shortcuts exist

### Anti-Patterns

```typescript
// ❌ Hover-only menu reveal
(mouseenter)="showMenu()" (mouseleave)="hideMenu()"

// ✅ Works on both mouse and touch
(mouseenter)="showMenu()" (mouseleave)="hideMenu()" (click)="toggleMenu()"

// ❌ Mouse-only drag
(mousedown)="startDrag($event)"

// ✅ Mouse + touch drag
(mousedown)="startDrag($event)" (touchstart)="startDrag($event)"

// ❌ Right-click only context menu
(contextmenu)="openMenu($event)"

// ✅ Right-click + long-press
// In ngAfterViewInit:
// onLongPress(this.el.nativeElement, (e) => this.openMenu(e))
```

---

## Working Strategy — Zero Assumptions

> **"Assuming is a bad working strategy."**

**Never assume** something is working or broken — always verify with
concrete evidence before making any claim.

- **Before claiming a root cause**: add debug logs, compare actual values,
  show concrete data
- **Before saying "X is broken"**: screenshot it, compare with the reference
  implementation
- **Before saying "X works correctly"**: test with real data, not just
  unit tests
- **When comparing with a reference implementation**: also check the original
  source when applicable (e.g., for PDF rendering: compare with both the C++
  output AND the actual PDF — sometimes the reference is wrong and we're right)
- **Before saying "X is fixed"**: verify the VISUAL rendering, not just the
  source code. For HTML: check what the browser SHOWS, not what the DOM
  contains (CSS transforms, bidi, font rendering can all change the visual).
  Take screenshots and compare with the reference.
- **If uncertain**: say "needs investigation" and outline diagnostic steps
  — do NOT guess or repeat the same unverified theory
- **Never repeat the same unverified claim** across multiple responses

---

## AI Agent Instructions

When generating or modifying components:

1. **Always check** if the component is compound (has child parts)
2. **If compound**, implement the dual-mode pattern
3. **Preserve existing template-driven API** — never remove it
4. **Add simple inputs** as a convenience layer on top
5. **Use `@ContentChild`** to detect projection
6. **Test both modes** in the spec file
7. **Follow naming conventions** exactly
8. **Form Components**: Support both `value` input and `ControlValueAccessor`
9. **Clean up unused declarations** — after writing or modifying code, verify
   every import, variable, and parameter is actually used. Remove any that
   aren't. Watch for `ts(6133)` errors.
10. **SonarQube compliance** — follow ALL rules in Section 4
    "SonarQube Compliance". **Before declaring ANY work done, run the full
    SonarQube server scan** (`npm run sonar:gate` against `localhost:9000`;
    `npm run sonar` alone is for iterating) and fix every reported issue — this
    is the mandatory DONE gate; eslint is not a substitute. If the
    token/server/Docker is unavailable, STOP and ask the human — the task is
    blocked, not done. Key rule points:
    - Mark never-reassigned members `readonly` (signals, computed, viewChild,
      arrow properties)
    - Use modern APIs: `Number.isNaN`, `Number.parseFloat`, `Math.hypot`,
      `structuredClone`, `.dataset`, `String.fromCodePoint`, `.codePointAt`,
      `.replaceAll`, `globalThis`
    - Keep cognitive complexity ≤ 15 — extract helpers, use early returns
    - No negated if/else, no nested ternaries, no duplicate branches
    - Merge duplicate imports, extract repeated union types into aliases
    - Use `for-of` over index-based `for` when index is only used for access
    - Use `RegExp.exec()` over `String.match()` for single matches
11. **Responsive design** — follow ALL rules in Section 5. Every hardcoded
    pixel width/height MUST have responsive breakpoints. Every flex toolbar
    MUST wrap. Every overlay MUST have `max-w-[calc(100vw-2rem)]`. Test
    mentally at 320px, 375px, 768px, 1920px.
12. **Touch compatibility** — follow ALL rules in Section 6. Every
    `(mouseenter)` needs a touch alternative. Every `(mousedown)` for drag
    needs `(touchstart)`. Every `(contextmenu)` needs long-press. Every
    `(dblclick)` needs double-tap. Use `lib/touch.ts` utilities.
13. **E2E coverage** — after adding or modifying a component, follow the
    "E2E Authoring Workflow" section. Run
    `npm run e2e:scaffold -- <name>` for any new component, then
    `npm run e2e -- <name>` to confirm it passes. DO NOT manually edit
    `e2e/orchestrator/specs.ts` for single-component specs — they are
    auto-discovered from the harness folder. Only multi-component or
    `initArgs`-override specs belong in `EXPLICIT_SPECS`.
14. **🔴 Final DONE gate — SonarQube server scan.** This is the LAST step before
    declaring any task/plan/PR complete, and it is mandatory:
    `npm run sonar:gate` (coverage re-measured unless the tree fingerprint
    proves it current, then the Dockerized scanner against
    `http://localhost:9000`, project `shadcn-angular`) → open the server, fix
    **every** new issue on the changed files, re-scan (`npm run sonar` while
    fixing, `npm run sonar:gate` for the verdict) until clean. eslint /
    `eslint-plugin-sonarjs` does NOT satisfy this gate. If `SONAR_TOKEN`, the
    server, or Docker is unavailable, the work is **blocked, not done** — say so
    and ask the human; never claim SonarQube compliance from the eslint subset.

### Template for New Compound Components

```typescript
import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
  ContentChild,
  AfterContentInit,
} from '@angular/core';
import { cn } from '../lib/utils';

@Component({
  selector: 'ui-example-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()" [attr.data-slot]="'example-item'">
      @if (hasCustomContent()) {
        <ng-content />
      } @else {
        <ui-example-header>
          <ui-example-icon [variant]="variant()" />
        </ui-example-header>
        <ui-example-content>
          @if (title()) {
            <ui-example-title>{{ title() }}</ui-example-title>
          }
          @if (description()) {
            <ui-example-description>{{ description() }}</ui-example-description>
          }
        </ui-example-content>
      }
    </div>
  `,
  host: { class: 'contents' },
})
export class ExampleItemComponent implements AfterContentInit {
  class = input('');
  title = input<string>();
  description = input<string>();
  variant = input<'default' | 'primary'>('default');
  
  @ContentChild(ExampleHeaderComponent) customHeader?: ExampleHeaderComponent;
  @ContentChild(ExampleContentComponent) customContent?: ExampleContentComponent;
  
  private _hasCustomContent = signal(false);
  hasCustomContent = this._hasCustomContent.asReadonly();
  
  ngAfterContentInit() {
    this._hasCustomContent.set(!!this.customHeader || !!this.customContent);
  }
  
  classes = computed(() => cn(
    'relative flex gap-4',
    this.class()
  ));
}
```
