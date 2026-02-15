# shadcn-angular

Angular port of shadcn/ui — beautifully designed, copy-paste components built on Angular 21, Tailwind CSS v4, and Angular CDK.

---

## Project Overview

| Detail | Value |
|--------|-------|
| Angular | v21 (standalone components by default) |
| Styling | Tailwind CSS v4 + `cn()` utility (clsx + tailwind-merge) |
| Variants | class-variance-authority (CVA) |
| Testing | Vitest v4 + Playwright (browser mode, zoneless) |
| Docs | Storybook 10 |
| Package Manager | npm (workspaces) |
| Main Branch | `master` |

### Monorepo Structure

```
shadcn-angular/
├── packages/
│   ├── components/         # Component library (source of truth)
│   │   ├── ui/             # All component files
│   │   ├── lib/utils.ts    # cn(), isRtl()
│   │   └── styles.css      # Tailwind base styles
│   └── cli/                # CLI tool for scaffolding
├── demo/                   # Angular demo application
├── .storybook/             # Storybook configuration
├── vitest.config.ts
├── tsconfig.json
└── angular.json
```

### Path Aliases

```
@/* → packages/components/*
```

Use `@/ui/button.component` to import from the component library. The demo app uses `@/*` → `src/*` locally.

---

## Commands

```bash
npm run dev              # Start demo app (ng serve)
npm run test             # Run Vitest (all packages + demo)
npm run test-visual      # Run Vitest with browser UI (Chromium)
npm run storybook        # Start Storybook on port 6006
npm run build-storybook  # Build static Storybook
npm run build:demo       # Build demo app
npm run build:cli        # Build CLI package
```

---

## Core Philosophy

> **"If you project content, you get full control. If you don't, you get sensible defaults."**

Components must be:
- **Easy to start** — Simple inputs for common use cases
- **Easy to customize** — Content projection for full control
- **Easy to understand** — The source code lives in YOUR project

---

## TypeScript Rules

- Strict mode is enabled (`strict: true`, `strictTemplates: true`)
- No `any` type — use `unknown` when type is uncertain
- Prefer type inference when the type is obvious
- **No unused declarations** — no unused imports, variables, parameters, or types in `.ts` files or `@Component({ imports: [] })`. The compiler enforces `noUnusedLocals` and `noUnusedParameters` — every import, variable, and parameter must be used. Before finishing any file, verify there are no `ts(6133)` ("declared but its value is never read") or `ts(6196)` ("declared but never used") errors.
- Export component types (e.g., `ButtonVariant`, `ButtonSize`) when using CVA

---

## Angular Rules

### Components
- Always use standalone components (do NOT set `standalone: true` — it's the default in Angular 21)
- Use `ChangeDetectionStrategy.OnPush` in every `@Component` decorator
- Use `input()` and `output()` functions, never `@Input`/`@Output` decorators
- Use `computed()` for derived state
- Use `signal()` for local mutable state
- Keep components small and focused on a single responsibility
- Prefer inline templates for small components

### Host & Styling
- Do NOT use `@HostBinding` or `@HostListener` — use the `host` object in `@Component` instead
- Do NOT use `ngClass` — use `[class]` bindings
- Do NOT use `ngStyle` — use `[style]` bindings
- Use `host: { '[class]': '"contents"' }` to prevent wrapper div issues

### Templates
- Use native control flow (`@if`, `@for`, `@switch`) — never `*ngIf`, `*ngFor`, `*ngSwitch`
- Use `track` expression in every `@for` loop (e.g., `@for (item of items(); track item.id)`)
- Do NOT write arrow functions in templates (not supported)
- Do NOT assume globals like `new Date()` are available in templates
- Use the `async` pipe to unwrap observables in templates

### Services & DI
- Use `inject()` function, never constructor injection
- Use `providedIn: 'root'` for singleton services

### Forms
- Prefer Reactive forms over template-driven forms
- Form components must support both `value` input and `ControlValueAccessor`

### Signals & State
- Use `signal()` for local mutable state
- Use `computed()` for derived state
- Use `update()` or `set()` on signals — never `mutate()`
- Keep state transformations pure and predictable

---

## Styling Rules

- Tailwind CSS v4 — utility-first, no SCSS
- Use `cn()` from `@/lib/utils` to merge Tailwind classes with proper precedence
- Use `class-variance-authority` (CVA) for variant-driven class maps
- Every component MUST have a `class` input for style extension:

```typescript
class = input('');

classes = computed(() => cn(
  'base-classes here',
  this.class()
));
```

- Do NOT use `ViewEncapsulation.None` or `ViewEncapsulation.ShadowDom`
- Dark mode: use Tailwind's `dark:` prefix — the design system supports it out of the box

---

## The Dual-Mode Pattern

Every **compound** component must support TWO usage modes:

### Mode 1: Simple Mode (Input-Driven)

```html
<ui-timeline-item
  title="Version 2.0 Released"
  description="Major update with new features."
  time="January 2024"
  variant="success" />
```

### Mode 2: Custom Mode (Content Projection)

```html
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

### Implementation

```typescript
@Component({
  selector: 'ui-example-item',
<<<<<<< HEAD
=======
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
>>>>>>> origin/master
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
  host: { '[class]': '"contents"' },
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

### When to Apply

```
Is the component compound (has child parts)?
├── NO → Simple inputs only (Button, Badge, Input, Progress)
└── YES → Does it commonly need customization?
    ├── NO → Data-driven only (Pagination)
    └── YES → Apply the dual-mode pattern (Timeline, Breadcrumb, Accordion, Tree, Stepper)
```

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

### Inputs

```typescript
// Content inputs (simple mode)
title = input<string>();
description = input<string>();
label = input<string>();

// Configuration inputs
variant = input<'default' | 'primary'>('default');
size = input<'sm' | 'md' | 'lg'>('md');
disabled = input<boolean>(false);

// Data-driven inputs
items = input<T[]>();
data = input<T>();
options = input<Option[]>();
```

### Outputs

```typescript
// Use past-tense verb or noun for event names
clicked = output<MouseEvent>();
changed = output<string>();
closed = output<void>();
itemSelected = output<Item>();
```

### File Naming

```
packages/components/ui/
├── {component}.component.ts           # Component source
├── {component}.component.spec.ts      # Unit tests
└── {component}.stories.ts             # Storybook stories
```

---

## Anti-Patterns

### Do NOT do this

```typescript
// Angular Material style — forces developers to extend/override
@Component({
  encapsulation: ViewEncapsulation.None,
})
```

```html
<!-- Only data-driven — no way to customize individual items -->
<ui-timeline [items]="timelineData" />
```

```html
<!-- Only template-driven — too verbose for simple cases -->
<ui-timeline-item>
  <ui-timeline-header>
    <ui-timeline-dot variant="success" />
    <ui-timeline-connector />
  </ui-timeline-header>
  <ui-timeline-content>
    <ui-timeline-title>Simple Title</ui-timeline-title>
  </ui-timeline-content>
</ui-timeline-item>
```

### Do this instead

```html
<!-- Simple case -->
<ui-timeline-item title="Simple Title" variant="success" />

<!-- Complex case — full control when needed -->
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

## Testing

Tests use **Vitest** with Playwright browser mode (zoneless). Import from `vitest`, not `jasmine` or `jest`.

### Test Structure

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { ExampleComponent } from './example.component';

describe('ExampleComponent', () => {
  let component: ExampleComponent;
  let fixture: ComponentFixture<ExampleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExampleComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ExampleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should apply variant classes', () => {
    fixture.componentRef.setInput('variant', 'destructive');
    fixture.detectChanges();

    const el = fixture.debugElement.query(By.css('[data-slot="example"]'));
    expect(el.nativeElement.className).toContain('bg-destructive');
  });
});
```

### Testing Rules

- Tests must verify actual functionality (interactions, state changes, class application), not just `should create`
- Use `fixture.componentRef.setInput()` to set inputs
- Use `By.css('[data-slot="..."]')` or `By.directive(...)` to query elements
- For compound components: use a `TestHostComponent` to test content projection
- For RTL: wrap in `<div [dir]="dir()">` and test both directions
- Cover both simple mode and custom mode for dual-mode components

---

## Storybook

Stories use Storybook 10 with `@storybook/angular`.

### Story Structure

```typescript
import { Meta, StoryObj } from '@storybook/angular';
import { ExampleComponent } from './example.component';

const meta: Meta<ExampleComponent> = {
  title: 'UI/Example',
  component: ExampleComponent,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'primary', 'destructive'],
    },
  },
  args: {
    variant: 'default',
  },
};

export default meta;
type Story = StoryObj<ExampleComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `<ui-example [variant]="variant">Content</ui-example>`,
  }),
};
```

### Story Rules

- Every component must have a Storybook story covering all inputs/variants
- Use `tags: ['autodocs']` for auto-generated documentation
- Use `argTypes` with `control: 'select'` for enum inputs

---

## Accessibility

- Must pass all AXE checks
- Must meet WCAG AA minimums: focus management, color contrast, ARIA attributes
- Every interactive element needs proper ARIA attributes and keyboard navigation
- Use `[attr.data-slot]` on every component root for testing/styling hooks
- RTL support: verify correct rendering with `[dir]="'rtl'"` on a parent element

---

## Quality Standards

### Composition
- Prefer existing package components (e.g., `ui-button`, `ui-badge`) over raw HTML elements in compound components

### Code Hygiene
- No implementation comments inside methods — code should be self-documenting
- Use JSDoc `/** ... */` only for public API (inputs, outputs, exported functions)
- **No unused declarations** — remove all unused imports, variables, parameters, and types in TypeScript files and `@Component({ imports: [...] })`. Check for `ts(6133)` errors before finishing.
- Strict typing — no `any`, handle `undefined`

### Documentation
- Storybook story for every component
- Demo page with copy-paste ready examples

---

## Checklist for New Components

- [ ] Has `class` input for style extension
- [ ] Uses `ChangeDetectionStrategy.OnPush`
- [ ] Uses `input()`, `output()`, and `computed()` (not decorators)
- [ ] Has `[attr.data-slot]` on root element
- [ ] Uses `host: { '[class]': '"contents"' }`
- [ ] If compound: supports both simple and custom modes
- [ ] If compound: uses existing package components where possible
- [ ] Accessibility: proper ARIA attributes + keyboard navigation
- [ ] RTL: verifies correct rendering in both directions
- [ ] Tests: covers both usage modes, verifies real functionality
- [ ] Storybook: covers all variants/inputs
- [ ] Demo page: includes copy-paste examples
- [ ] No unused declarations (imports, variables, parameters, types) — no `ts(6133)` errors
- [ ] Strict typing (no `any`)
- [ ] Uses `inject()` for DI (not constructor injection)

---

## AI Agent Instructions

When generating or modifying components:

1. **Read first** — always read existing code before modifying
2. **Check if compound** — does it have child parts?
3. **If compound** — implement the dual-mode pattern
4. **Preserve existing API** — never remove existing template-driven API
5. **Add simple inputs** as a convenience layer on top
6. **Use `@ContentChild`** to detect projection
7. **Follow naming conventions** exactly
8. **Form components** — support both `value` input and `ControlValueAccessor`
9. **Test both modes** in the spec file
10. **Run tests** with `npm run test` after changes
11. **Do not add `standalone: true`** — it's the default in Angular 21
12. **Use `inject()`** — never constructor injection
13. **Clean up unused declarations** — after writing or modifying code, verify every import, variable, and parameter is actually used. Remove any that aren't. Watch for `ts(6133)` errors.
