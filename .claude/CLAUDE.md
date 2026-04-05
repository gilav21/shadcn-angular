# Component Design Guidelines

> **For Human & AI Contributors**

This document defines how to build components in shadcn-angular. Follow these patterns exactly for predictable, consistent contributions.

---

## Core Philosophy

> **"If you project content, you get full control. If you don't, you get sensible defaults."**

We escaped Angular Material because customization was a nightmare. Our components must be:
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

```
Is the component compound (has child components)?
├── NO → Use simple inputs only (Button, Badge, Input)
└── YES → Does it commonly need customization?
    ├── NO → Consider data-driven only (Pagination)
    └── YES → Apply the dual-mode pattern
        └── Examples: Timeline, Breadcrumb, Accordion, Tree
```

### Components That SHOULD Have Dual Mode

| Component | Simple Inputs | Custom Content |
|-----------|---------------|----------------|
| Timeline | `title`, `description`, `time`, `variant` | `<ui-timeline-header>`, `<ui-timeline-content>` |
| Breadcrumb | `[items]` array | `<ui-breadcrumb-item>` slots |
| Accordion | `title`, `content` | `<ui-accordion-trigger>`, `<ui-accordion-content>` |
| Tree | `[data]` array | `<ui-tree-item>` nested structure |
| Stepper | `[steps]` array | `<ui-stepper-item>` slots |

### Components That Should Remain Simple

| Component | Reason |
|-----------|--------|
| Button | Single element, no compound structure |
| Badge | Single element |
| Input | Single element with variants |
| Progress | Just needs `[value]` |
| Avatar | Already has good projection pattern |

---

## Naming Conventions

### Component Selectors

```
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

## Anti-Patterns (What NOT to Do)

### ❌ Angular Material Style (Don't Do This)

```typescript
// BAD: Forcing developers to extend/override
@Component({
  encapsulation: ViewEncapsulation.None,  // DONT DO THIS
  // Deep component hierarchy that's hard to customize
})
```

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
- **Prefer Package Components**: When building compound components, prioritize using existing package components (e.g., `ui-button`, `ui-badge`) over native HTML elements. This ensures consistent styling, functionality, and accessibility.

### 2. Code Hygiene
- **No Non-JSDoc Comments**: Avoid implementation comments inside methods. Code should be self-documenting. Use JSDoc `/** ... */` only for public APIs (inputs, outputs, exported methods).
- **No Unused Declarations**: Remove all unused imports, variables, parameters, and types in TypeScript files and the `@Component({ imports: [...] })` array. The compiler enforces `noUnusedLocals` and `noUnusedParameters` — check for `ts(6133)` ("declared but its value is never read") errors before finishing any file.

### 3. Testing & Documentation
- **Meaningful Unit Tests**: Tests must verify actual functionality (interactions, state changes), not just component creation.
- **Storybook**: Every component must have a Storybook story showing all inputs/options.
- **Demo Page**: Create a rich demo page with unique variants and "copy-paste ready" examples for developers.

### 4. SonarQube Compliance (Zero Tolerance)

All code must pass SonarQube with **zero issues**. Apply these rules from the start:

#### TypeScript Strictness
- **No `any` types** — use proper generics or `unknown`
- **No unnecessary type assertions** (`as Type`) — only assert when the compiler genuinely can't infer the type (S4325)
- **Mark never-reassigned members `readonly`** — signals, computed, viewChild, arrow function properties, etc. (S2933)
- **Remove all unused imports, variables, parameters** (S1128, ts6133)
- **Merge duplicate imports** from the same module into one statement (S3863)
- **Extract repeated union types into type aliases** — if a union like `'sm' | 'md' | 'lg'` appears 3+ times, create a `type Size = 'sm' | 'md' | 'lg'` (S4323)

#### Modern API Preferences
- **`Number.isNaN()`** over `isNaN()`, **`Number.isFinite()`** over `isFinite()`, **`Number.parseFloat()`** over `parseFloat()` (S7773)
- **`String.fromCodePoint()`** over `String.fromCharCode()`, **`.codePointAt()`** over `.charCodeAt()` (S7758)
- **`Math.hypot(dx, dy)`** over `Math.sqrt(dx*dx + dy*dy)` (S7769)
- **`structuredClone(obj)`** over `JSON.parse(JSON.stringify(obj))` (S7784)
- **`el.dataset.fooBar`** over `el.getAttribute('data-foo-bar')` / `el.setAttribute('data-foo-bar', ...)` / `el.hasAttribute('data-foo-bar')` (S7761)
- **`RegExp.exec(str)`** over `str.match(regex)` for single matches (S6594)
- **`.replaceAll()`** over `.replace()` with global regex flag `/g` (S7781)
- **`globalThis`** over `window` when accessing global scope (S7764)
- **`new Array(n)`** over `Array(n)` (S7723)
- **`Blob.text()`** over `FileReader.readAsText()` (S7756)
- **`\d`** over `[0-9]` in regex (S6353)

#### Cognitive Complexity (S3776 — max 15)
- **Keep functions under 15 cognitive complexity** — this is the most common SonarQube violation
- **Extract helper functions** for nested logic blocks
- **Use early returns** (guard clauses) to reduce nesting depth
- **Extract switch/case bodies** into separate named functions
- **Extract loop bodies** when they contain conditionals

#### Control Flow & Logic
- **No negated conditions in if/else** — flip the branches: `if (!x) { A } else { B }` → `if (x) { B } else { A }` (S7735)
- **No nested ternaries** — extract to variables or if/else (S3358)
- **No duplicate branch/case blocks** — merge identical branches with `||` or fall-through cases (S1871)
- **No redundant assignments** — don't re-assign a variable to the value it already holds (S4165)
- **No loop variable reassignment** — use `while` loops or restructure (S2310)
- **Use `for-of`** instead of index-based `for` when the index is only used for array access (S4138)
- **Use `else if`** instead of `if` as the only statement in an `else` block (S6660)
- **Always handle or comment catch blocks** — no empty `catch {}` (S2486)
- **Always provide initial value to `.reduce()`** (S6959)
- **No identical sub-expressions** in `||` or `&&` (S1764)
- **Avoid boolean parameters** that switch behavior — use separate methods instead (S2301)

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
- [ ] If compound: uses existing package components (not raw HTML) where possible
- [ ] Accessibility: proper ARIA attributes and keyboard navigation
- [ ] RTL Support: verifies correct rendering in RTL mode
- [ ] Tests cover both usage modes and verify functionality
- [ ] Storybook covers all options/variants
- [ ] Demo page includes copy-paste examples
- [ ] No unused declarations (imports, variables, parameters, types) — no `ts(6133)` errors
- [ ] Strict typing (no `any`, handles `undefined`)
- [ ] SonarQube zero issues — all rules in Section 4 above are followed
- [ ] No cognitive complexity > 15 in any function
- [ ] All class members that aren't reassigned are `readonly`
- [ ] Uses modern APIs (`Number.isNaN`, `structuredClone`, `.dataset`, etc.)
- [ ] Responsive: works from 320px phone to ultrawide (see Section 5)
- [ ] Touch: all interactions work on touch-only devices (see Section 6)

---

## 5. Responsive Design (Zero Tolerance)

Every component MUST render correctly across all viewport widths: **320px → 375px → 640px → 768px → 1024px → 1920px+**. Desktop appearance must not change — responsive rules only add mobile/tablet adaptations.

### Rules

#### No Hardcoded Pixel Widths Without Responsive Breakpoints
- **Never** use `w-[Npx]`, `min-w-[Npx]`, or `max-w-[Npx]` alone — always pair with responsive variants
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
- Apply to: Card, Dialog, Sheet, Drawer, Empty, and any container with `p-6`+ or `gap-6`+

#### Flex Layouts Must Wrap
- ❌ `flex items-center justify-between` on toolbars/controls — overflows on mobile
- ✅ `flex flex-wrap items-center justify-between gap-2`

#### Overflow Protection for Popups/Overlays
- **Every** absolutely/fixed positioned element (popover, dropdown, menu, toast, nav content) MUST have `max-w-[calc(100vw-2rem)]` to prevent viewport overflow

#### Text Truncation
- Long text in constrained containers MUST use `truncate`, `line-clamp-N`, or `overflow-hidden`
- Chip/badge text: use responsive max-width `max-w-[120px] sm:max-w-[200px] truncate`

### Testing Viewports
Verify every component at: **320px**, **375px**, **640px**, **768px**, **1024px**, **1920px**

---

## 6. Touch Device Compatibility (Zero Tolerance)

Every interactive component MUST work on touch-only devices (phones, tablets) with no mouse or keyboard. Use the shared `touch.ts` utility (`isTouchDevice()`, `onLongPress()`, `onDoubleTap()`) from `lib/touch.ts`.

### Rules

#### No Hover-Only Interactions
- If `(mouseenter)`/`(mouseleave)` reveals essential UI (buttons, menus, content), add a touch alternative
- ✅ Hover Card / Tooltip: tap to open, tap elsewhere to dismiss
- ✅ Navigation Menu / Menubar: tap to toggle submenus
- ✅ Dropdown submenu: tap to expand (not hover-only)
- CSS `opacity-0 group-hover:opacity-100` for essential controls → add `@media (hover: none) { opacity: 1 }` or always-visible on touch

#### No Mouse-Only Drag and Drop
- HTML5 drag events (`dragstart`, `dragover`, `drop`, `dragend`) do NOT work on mobile Safari/Chrome
- Every `(mousedown)` for dragging MUST have a matching `(touchstart)` with `touch-action: none`
- Every `(window:mousemove)/(window:mouseup)` MUST have `(window:touchmove)/(window:touchend)`
- Reference: `resizable.component.ts` and `slider.component.ts` already implement both correctly — follow their pattern

#### No Right-Click-Only Context Menus
- `(contextmenu)` requires right-click — unavailable on touch
- Add long-press (500ms touch hold) as alternative using `onLongPress()` from `lib/touch.ts`

#### No Double-Click-Only Actions
- `(dblclick)` doesn't work reliably on touch
- Add double-tap detection using `onDoubleTap()` from `lib/touch.ts`
- Data table inline editing is the primary case

#### Touch Target Sizing
- All interactive elements MUST be at least **44×44px** on touch devices (WCAG 2.5.8, Apple/Google HIG)
- The global `@media (pointer: coarse)` rule in `tailwind.css` enforces this as a baseline

#### No Keyboard-Shortcut-Only Features
- If a feature is only accessible via keyboard shortcut (Ctrl+C, Shift+Click range select, etc.), provide a touch alternative
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
// In ngAfterViewInit: onLongPress(this.el.nativeElement, (e) => this.openMenu(e))
```

---

## Working Strategy — Zero Assumptions

> **"Assuming is a bad working strategy."**

**Never assume** something is working or broken — always verify with concrete evidence before making any claim.

- **Before claiming a root cause**: add debug logs, compare actual values, show concrete data
- **Before saying "X is broken"**: screenshot it, compare with the reference implementation
- **Before saying "X works correctly"**: test with real data, not just unit tests
- **When comparing with a reference implementation**: also check the original source when applicable (e.g., for PDF rendering: compare with both the C++ output AND the actual PDF — sometimes the reference is wrong and we're right)
- **Before saying "X is fixed"**: verify the VISUAL rendering, not just the source code. For HTML: check what the browser SHOWS, not what the DOM contains (CSS transforms, bidi, font rendering can all change the visual). Take screenshots and compare with the reference.
- **If uncertain**: say "needs investigation" and outline diagnostic steps — do NOT guess or repeat the same unverified theory
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
9. **Clean up unused declarations** — after writing or modifying code, verify every import, variable, and parameter is actually used. Remove any that aren't. Watch for `ts(6133)` errors.
10. **SonarQube compliance** — follow ALL rules in Section 4 "SonarQube Compliance". Key points:
    - Mark never-reassigned members `readonly` (signals, computed, viewChild, arrow properties)
    - Use modern APIs: `Number.isNaN`, `Number.parseFloat`, `Math.hypot`, `structuredClone`, `.dataset`, `String.fromCodePoint`, `.codePointAt`, `.replaceAll`, `globalThis`
    - Keep cognitive complexity ≤ 15 — extract helpers, use early returns
    - No negated if/else, no nested ternaries, no duplicate branches
    - Merge duplicate imports, extract repeated union types into aliases
    - Use `for-of` over index-based `for` when index is only used for access
    - Use `RegExp.exec()` over `String.match()` for single matches
11. **Responsive design** — follow ALL rules in Section 5. Every hardcoded pixel width/height MUST have responsive breakpoints. Every flex toolbar MUST wrap. Every overlay MUST have `max-w-[calc(100vw-2rem)]`. Test mentally at 320px, 375px, 768px, 1920px.
12. **Touch compatibility** — follow ALL rules in Section 6. Every `(mouseenter)` needs a touch alternative. Every `(mousedown)` for drag needs `(touchstart)`. Every `(contextmenu)` needs long-press. Every `(dblclick)` needs double-tap. Use `lib/touch.ts` utilities.

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
