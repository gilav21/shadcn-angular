# Component Pattern Audit

Analysis of 100+ components for dual-mode pattern compliance.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Has input defaults + projection override |
| ⚠️ | Needs enhancement (compound component, template-only) |
| 🎯 | Correct as-is (simple component, no compound structure) |

---

## Audit Results

### Form Components

| Component | Status | Notes |
|-----------|--------|-------|
| `button` | 🎯 | Simple, variants via inputs |
| `input` | 🎯 | Simple element |
| `checkbox` | ✅ | Has `label` input with conditional rendering |
| `radio-group` | ✅ | Items have `label` input + parent has data-driven mode |
| `select` | ✅ | Has `[options]` data-driven + template slots |
| `textarea` | 🎯 | Simple element |
| `field` | ✅ | Has input defaults + ng-content |
| `label` | 🎯 | Simple element |
| `input-otp` | 🎯 | Data-driven via `maxLength` |
| `chip-list` | ✅ | Form-control based via `chips` signal + ControlValueAccessor |
| `autocomplete` | ✅ | Has `[options]` data-driven |
| `color-picker` | 🎯 | All-in-one component |
| `file-upload` | 🎯 | All-in-one with slots |
| `rating` | 🎯 | Simple with `[value]` |
| `date-picker` | 🎯 | Wraps calendar |
| `native-select` | 🎯 | Simple native element |
| `switch` | 🎯 | Simple toggle with ControlValueAccessor |
| `toggle` | 🎯 | Simple interactive element with variant/size inputs |
| `toggle-group` | ✅ | Has `[items]` input for data-driven mode + projection |
| `slider` | 🎯 | Simple range input with RTL support |
| `input-group` | 🎯 | Structural wrapper |
| `emoji-picker` | 🎯 | All-in-one picker |

### Data Display

| Component | Status | Notes |
|-----------|--------|-------|
| `badge` | 🎯 | Simple element |
| `card` | 🎯 | Projection-based, no need for inputs |
| `table` | ⚠️ | Projection-only; `data-table` exists separately for data-driven use |
| `data-table` | ✅ | Fully data-driven |
| `avatar` | ✅ | Has image input + fallback projection |
| `skeleton` | 🎯 | CSS-only |
| `tooltip` | 🎯 | Single directive |
| `timeline` | ✅ | Has `title`, `description`, `time`, `variant` inputs + projection |
| `tree` | ✅ | Has `data = input<TreeNode[]>([])` with full dual-mode |
| `calendar` | 🎯 | Data-driven |
| `number-ticker` | 🎯 | Simple `[value]` |
| `empty` | 🎯 | Simple with slots |
| `bento-grid` | 🎯 | Structural/layout |
| `code-block` | 🎯 | Simple display |
| `icon` | 🎯 | Simple SVG wrapper |
| `kbd` | 🎯 | Simple keyboard key display |
| `separator` | 🎯 | Simple visual divider |
| `spinner` | 🎯 | Simple loading indicator |
| `streaming-text` | 🎯 | Animated text display |

### Navigation

| Component | Status | Notes |
|-----------|--------|-------|
| `breadcrumb` | ✅ | Has `[items]` input + auto separators |
| `pagination` | ✅ | Has `currentPage`, `totalPages`, `siblingCount`, `pageChange` |
| `tabs` | ✅ | Has `[tabs]` config array + projection fallback |
| `navigation-menu` | ✅ | Has `[items]` input + auto-renders navigation structure |
| `menubar` | ⚠️ | Template-driven only, complexity may justify this |
| `sidebar` | 🎯 | Structural component |
| `stepper` | ✅ | Has `[steps]` config array + `activeStep` model |

### Feedback

| Component | Status | Notes |
|-----------|--------|-------|
| `alert` | ✅ | Has `title` + projection |
| `alert-dialog` | 🎯 | Projection-based |
| `dialog` | 🎯 | Projection-based |
| `drawer` | 🎯 | Projection-based |
| `sheet` | 🎯 | Projection-based |
| `progress` | 🎯 | Simple `[value]` |
| `toast` | 🎯 | Service-driven |

### Menus

| Component | Status | Notes |
|-----------|--------|-------|
| `dropdown-menu` | ✅ | Has `[items]` input with `shortcut` in interface + projection |
| `context-menu` | ✅ | Has `[items]` input with shortcuts, sub-menus + projection |
| `command` | ✅ | Service-based, items have `shortcut` input |
| `hover-card` | 🎯 | Projection-based |
| `popover` | 🎯 | Projection-based |

### Layout

| Component | Status | Notes |
|-----------|--------|-------|
| `accordion` | ✅ | Items have `title` + `content` inputs with dual-mode rendering |
| `collapsible` | 🎯 | Projection-based |
| `resizable` | 🎯 | Structural component |
| `carousel` | 🎯 | Projection-based |
| `scroll-area` | 🎯 | Wrapper component |
| `aspect-ratio` | 🎯 | Simple `[ratio]` |
| `button-group` | 🎯 | Simple wrapper with `class` + `orientation` |
| `split-button` | 🎯 | Button variant with dropdown |

### Effects

| Component | Status | Notes |
|-----------|--------|-------|
| `sparkles` | 🎯 | Wrapper effect |
| `text-reveal` | 🎯 | Simple input |
| `shimmer` | 🎯 | CSS effect |
| `confetti` | 🎯 | Service-driven |

### Compound — Needs Pattern Review

| Component | Status | Notes |
|-----------|--------|-------|
| `rich-text-editor` | 🎯 | Complex editor paradigm with toolbar, mention, image-resizer; service-driven |
| `dock` | ✅ | Has `[items]` input for data-driven mode + projection |
| `chat` | ✅ | `ChatMessageComponent` has `content`, `role`, `avatar` inputs + projection |
| `tree-select` | ✅ | Has `[nodes]` input for data-driven mode + projection |
| `virtual-scroll` | 🎯 | Structural utility |
| `shortcut-bindings-dialog` | 🎯 | Specialized dialog |

---

## Remaining Enhancement Queue

All priority items are complete. Only **Menubar** remains template-driven only, which is intentional given its complexity. **Table** is also intentionally template-driven since `data-table` covers the data-driven use case.
