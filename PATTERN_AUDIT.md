# Component Pattern Audit

Analysis of 80+ components for dual-mode pattern compliance.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Already has input defaults + projection override |
| ⚠️ | Needs enhancement (compound component, template-only) |
| 🎯 | Correct as-is (simple component, no compound structure) |

---

## Audit Results

### Form Components

| Component | Status | Notes |
|-----------|--------|-------|
| `button` | 🎯 | Simple, variants via inputs |
| `input` | 🎯 | Simple element |
| `checkbox` | ⚠️ | Needs inline label option |
| `radio-group` | ⚠️ | Items need inline label option |
| `select` | ✅ | Has `[options]` data-driven + template slots |
| `textarea` | 🎯 | Simple element |
| `field` | ✅ | Has input defaults + ng-content |
| `label` | 🎯 | Simple element |
| `input-otp` | 🎯 | Data-driven via `maxLength` |
| `chip-list` | ⚠️ | Could benefit from `[chips]` input array |
| `autocomplete` | ✅ | Has `[options]` data-driven |
| `color-picker` | 🎯 | All-in-one component |
| `file-upload` | 🎯 | All-in-one with slots |
| `rating` | 🎯 | Simple with `[value]` |
| `date-picker` | 🎯 | Wraps calendar |
| `native-select` | 🎯 | Simple native element |

### Data Display

| Component | Status | Notes |
|-----------|--------|-------|
| `badge` | 🎯 | Simple element |
| `card` | 🎯 | Projection-based, no need for inputs |
| `table` | ⚠️ | Could add `[data]` + column defs |
| `data-table` | ✅ | Fully data-driven |
| `avatar` | ✅ | Has image input + fallback projection |
| `skeleton` | 🎯 | CSS-only |
| `tooltip` | 🎯 | Single directive |
| `timeline` | ✅ (now) | Simple mode added via inputs |
| `tree` | ⚠️ | Could add `[data]` input for simple cases |
| `calendar` | 🎯 | Data-driven |
| `number-ticker` | 🎯 | Simple `[value]` |
| `empty` | 🎯 | Simple with slots |

### Navigation

| Component | Status | Notes |
|-----------|--------|-------|
| `breadcrumb` | ⚠️ | **Priority**: Add `[items]` + auto separators |
| `pagination` | ⚠️ | **Priority**: Add data-driven mode |
| `tabs` | ✅ | Has both modes |
| `navigation-menu` | ⚠️ | Complex, could add `[items]` |
| `menubar` | ⚠️ | Complex nested structure |
| `sidebar` | 🎯 | Structural component |
| `stepper` | ⚠️ | **Priority**: Fix value/index confusion, add `[steps]` |

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
| `dropdown-menu` | ⚠️ | Items could have `shortcut` input |
| `context-menu` | ⚠️ | Items could have `shortcut` input |
| `command` | ⚠️ | Items need `icon` + `shortcut` inputs |
| `hover-card` | 🎯 | Projection-based |
| `popover` | 🎯 | Projection-based |

### Layout

| Component | Status | Notes |
|-----------|--------|-------|
| `accordion` | ⚠️ | Items could have `title` + `content` inputs |
| `collapsible` | 🎯 | Projection-based |
| `resizable` | 🎯 | Structural component |
| `carousel` | 🎯 | Projection-based |
| `scroll-area` | 🎯 | Wrapper component |
| `aspect-ratio` | 🎯 | Simple `[ratio]` |

### Effects

| Component | Status | Notes |
|-----------|--------|-------|
| `sparkles` | 🎯 | Wrapper effect |
| `text-reveal` | 🎯 | Simple input |
| `shimmer` | 🎯 | CSS effect |
| `confetti` | 🎯 | Service-driven |

---

## Priority Enhancement Queue

| Priority | Component | Enhancement |
|----------|-----------|-------------|
| 1 | Timeline | ✅ DONE - Added inputs |
| 2 | Breadcrumb | Add `[items]` input + auto separators |
| 3 | Pagination | Add `[currentPage]`, `[totalPages]`, `(pageChange)` |
| 4 | Stepper | Add `[steps]` input, fix index/value API |
| 5 | Checkbox/Radio | Add inline `label` input |
| 6 | Accordion | Add `title` + `content` inputs to items |
| 7 | Tree | Add `[data]` input for data-driven mode |
| 8 | Command items | Add `icon` + `shortcut` inputs |
