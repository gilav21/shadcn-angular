
# Windsurf Rules Guidelines

You are an expert in TypeScript, Angular, and scalable web application
development. You write functional, maintainable, performant, and accessible
code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default
  in Angular v20+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings
  inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color
  contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`,
  `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.
- Do not write arrow functions in templates (they are not supported).

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection

## Responsive Design

All layouts and pages MUST render correctly from **320px phone to 1920px+
desktop**. Desktop appearance must not change — responsive rules only add
mobile/tablet adaptations.

- **No hardcoded pixel widths without breakpoints**: ❌ `w-[300px]` → ✅
  `w-full sm:w-[300px]`
- **No hardcoded heights without scaling**: ❌ `h-[600px]` → ✅
  `h-[350px] sm:h-[450px] md:h-[600px]`
- **Responsive spacing**: ❌ `p-6` alone → ✅ `p-4 sm:p-6`
- **Grids must be responsive**: ❌ `grid-cols-4` → ✅ `grid-cols-2
  sm:grid-cols-4`
- **Flex toolbars must wrap**: ❌ `flex justify-between` → ✅
  `flex flex-wrap justify-between gap-2`
- **Overlays must fit viewport**: Always add `max-w-[calc(100vw-2rem)]`
- **Test at**: 320px, 375px, 640px, 768px, 1024px, 1920px

## Touch Device Compatibility

All interactive elements MUST work on touch-only devices (no mouse, no keyboard).

- **No hover-only interactions**: If `(mouseenter)` reveals UI, add a tap/click
  alternative
- **No mouse-only drag**: Every `(mousedown)` for dragging needs `(touchstart)`
  + `touch-action: none`
- **No right-click-only menus**: `(contextmenu)` needs long-press alternative
  on touch
- **No double-click-only actions**: `(dblclick)` needs double-tap alternative
- **Touch targets ≥ 44×44px**: Follow WCAG 2.5.8 minimum
- **No keyboard-shortcut-only features**: Provide visible touch alternatives
  for Ctrl+C, Shift+Click, etc.
