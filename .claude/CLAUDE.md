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
- **Clean Imports**: Remove all unused imports in TypeScript files and the `@Component({ imports: [...] })` array.

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
- [ ] No unused imports or commercial comments
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
