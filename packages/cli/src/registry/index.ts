// Component Registry - Defines available components and their file mappings
// Actual component files are stored in packages/components/ui/

export interface OptionalDependency {
  readonly name: string;
  readonly description: string;
}

export interface ComponentDefinition {
  readonly name: string;
  readonly files: readonly string[];
  readonly peerFiles?: readonly string[];
  readonly dependencies?: readonly string[];
  readonly optionalDependencies?: readonly OptionalDependency[];
  readonly npmDependencies?: readonly string[];
  readonly libFiles?: readonly string[];
  readonly shortcutDefinitions?: readonly {
    readonly exportName: string;
    readonly componentName: string;
    readonly sourceFile: string;
  }[];
}

function defineRegistry<T extends Record<string, ComponentDefinition>>(reg: T): { readonly [K in keyof T]: ComponentDefinition } {
    return reg;
}

export const registry = defineRegistry({
  accordion: {
    name: 'accordion',
    files: ['accordion/accordion.component.html', 'accordion/accordion.component.ts', 'accordion/index.ts', 'accordion/sub/accordion-content.component.html', 'accordion/sub/accordion-content.component.ts', 'accordion/sub/accordion-item.component.html', 'accordion/sub/accordion-item.component.ts', 'accordion/sub/accordion-trigger.component.html', 'accordion/sub/accordion-trigger.component.ts'],
  },
  autocomplete: {
    name: 'autocomplete',
    files: ['autocomplete.component.ts', 'highlight.pipe.ts'],
    dependencies: ['badge', 'command', 'popover'],
  },
  alert: {
    name: 'alert',
    files: ['alert.component.ts'],
  },
  'alert-dialog': {
    name: 'alert-dialog',
    files: ['alert-dialog.component.ts'],
  },
  'aspect-ratio': {
    name: 'aspect-ratio',
    files: ['aspect-ratio.component.ts'],
  },
  avatar: {
    name: 'avatar',
    files: ['avatar.component.ts'],
  },
  badge: {
    name: 'badge',
    files: ['badge.component.ts'],
  },
  breadcrumb: {
    name: 'breadcrumb',
    files: ['breadcrumb.component.ts'],
  },
  button: {
    name: 'button',
    files: ['button.component.ts'],
    dependencies: ['ripple'],
  },
  'button-group': {
    name: 'button-group',
    files: ['button-group.component.ts']
  },
  calendar: {
    name: 'calendar',
    files: ['calendar-locales.ts', 'calendar.component.ts'],
    dependencies: ['button', 'select'],
  },
  card: {
    name: 'card',
    files: ['card.component.ts'],
  },
  carousel: {
    name: 'carousel',
    files: ['carousel.component.ts'],
  },
  checkbox: {
    name: 'checkbox',
    files: ['checkbox.component.ts'],
  },
  collapsible: {
    name: 'collapsible',
    files: ['collapsible.component.ts'],
  },
  'color-picker': {
    name: 'color-picker',
    files: ['color-picker.component.ts'],
    dependencies: ['input', 'popover', 'tabs'],
    libFiles: ['touch.ts'],
  },
  confetti: {
    name: 'confetti',
    files: ['confetti.directive.ts'],
  },
  command: {
    name: 'command',
    files: ['command.component.ts'],
    dependencies: ['dialog'],
    libFiles: ['shortcut-binding.service.ts'],
    shortcutDefinitions: [
      {
        exportName: 'COMMAND_DIALOG_SHORTCUT_DEFINITIONS',
        componentName: 'command-dialog',
        sourceFile: 'command.component.ts',
      },
    ],
  },
  'context-menu': {
    name: 'context-menu',
    files: ['context-menu.component.ts'],
    libFiles: ['touch.ts'],
  },
  'date-picker': {
    name: 'date-picker',
    files: ['date-picker.component.ts'],
    dependencies: ['calendar'],
  },
  chat: {
    name: 'chat',
    files: ['chat.component.ts'],
    dependencies: ['avatar', 'button', 'scroll-area', 'textarea'],
  },
  'streaming-text': {
    name: 'streaming-text',
    files: ['streaming-text.component.ts'],
  },
  sparkles: {
    name: 'sparkles',
    files: ['sparkles.component.ts'],
    dependencies: ['button'],
  },
  'code-block': {
    name: 'code-block',
    files: ['code-block.component.ts'],
    libFiles: ['code-scopes.ts'],
    dependencies: ['button'],
  },
  'text-reveal': {
    name: 'text-reveal',
    files: ['text-reveal.component.ts'],
  },
  'data-table': {
    name: 'data-table',
    files: ['calendar-locales.ts', 'data-table/component-pool.service.ts', 'data-table/data-table-column-builder.ts', 'data-table/data-table-column-header.component.ts', 'data-table/data-table-date-filter.component.ts', 'data-table/data-table-multiselect-filter.component.ts', 'data-table/data-table-pagination.component.ts', 'data-table/data-table.component.ts', 'data-table/data-table.types.ts', 'data-table/data-table.utils.ts', 'data-table/index.ts'],
    peerFiles: [
      'context-menu-integrations.ts',
    ],
    dependencies: ['badge', 'button', 'calendar', 'checkbox', 'command', 'component-outlet', 'context-menu', 'icon', 'input', 'pagination', 'popover', 'select', 'table'],
    libFiles: ['parsers/xlsx.ts', 'touch.ts'],
    optionalDependencies: [
      { name: 'context-menu', description: 'Enables right-click context menus on rows and headers' },
    ],
  },
  dialog: {
    name: 'dialog',
    files: ['dialog.component.ts'],
  },
  dock: {
    name: 'dock',
    files: ['dock-icon.component.ts', 'dock-item.component.ts', 'dock-label.component.ts', 'dock.component.ts'],
  },
  'tree-select': {
    name: 'tree-select',
    files: ['tree-select.component.ts'],
    dependencies: ['popover', 'tree'],
  },
  'virtual-scroll': {
    name: 'virtual-scroll',
    files: ['virtual-scroll.component.ts'],
  },
  'input-mask': {
    name: 'input-mask',
    files: ['input-mask.directive.ts'],
    dependencies: ['input'],
  },
  drawer: {
    name: 'drawer',
    files: ['drawer.component.ts'],
  },
  'dropdown-menu': {
    name: 'dropdown-menu',
    files: ['dropdown-menu.component.ts'],
    libFiles: ['touch.ts'],
  },
  empty: {
    name: 'empty',
    files: ['empty.component.ts'],
  },
  field: {
    name: 'field',
    files: ['field.component.ts'],
  },
  icon: {
    name: 'icon',
    files: ['icon.component.ts', 'icon.token.ts'],
  },

  'file-upload': {
    name: 'file-upload',
    files: ['file-upload.component.ts'],
    dependencies: ['button', 'progress'],
  },
  'file-viewer': {
    name: 'file-viewer',
    files: ['file-viewer.component.ts'],
    dependencies: ['spinner'],
    libFiles: ['parsers/doc-enhanced-parser.ts', 'parsers/docx-parser.ts', 'parsers/file-type-detector.ts', 'parsers/image-validator.ts', 'parsers/inflate.ts', 'parsers/ole2-reader.ts', 'parsers/pdf-parser.ts', 'parsers/pdf-pixel-perfect.ts', 'parsers/ppt-parser.ts', 'parsers/pptx-parser.ts', 'parsers/svg-sanitizer.ts', 'parsers/ttf-builder.ts', 'parsers/ttf-parser.ts', 'parsers/xlsx-reader.ts', 'parsers/zip-reader.ts'],
  },
  'hover-card': {
    name: 'hover-card',
    files: ['hover-card.component.ts'],
    libFiles: ['touch.ts'],
  },
  input: {
    name: 'input',
    files: ['input-group.token.ts', 'input.component.ts'],
  },
  'input-group': {
    name: 'input-group',
    files: ['input-group.component.ts', 'input-group.token.ts'],
  },
  'input-otp': {
    name: 'input-otp',
    files: ['input-otp.component.ts'],
  },
  kbd: {
    name: 'kbd',
    files: ['kbd.component.ts'],
  },
  label: {
    name: 'label',
    files: ['label.component.ts'],
  },
  menubar: {
    name: 'menubar',
    files: ['menubar.component.ts'],
    libFiles: ['touch.ts'],
  },
  'native-select': {
    name: 'native-select',
    files: ['native-select.component.ts'],
  },
  'navigation-menu': {
    name: 'navigation-menu',
    files: ['navigation-menu.component.ts'],
    libFiles: ['touch.ts'],
  },
  'number-input': {
    name: 'number-input',
    files: ['input-group.token.ts', 'number-input.component.ts'],
    dependencies: ['input'],
  },
  'number-ticker': {
    name: 'number-ticker',
    files: ['number-ticker.component.ts'],
  },
  pagination: {
    name: 'pagination',
    files: ['pagination.component.ts'],
  },
  'phone-input': {
    name: 'phone-input',
    files: ['input-group.token.ts', 'phone-input-data.ts', 'phone-input.component.ts'],
    dependencies: ['input', 'input-group', 'input-mask', 'popover'],
  },
  popover: {
    name: 'popover',
    files: ['popover.component.ts'],
  },
  progress: {
    name: 'progress',
    files: ['progress.component.ts'],
  },
  'radio-group': {
    name: 'radio-group',
    files: ['radio-group.component.ts'],
  },
  rating: {
    name: 'rating',
    files: ['rating.component.ts'],
    libFiles: ['touch.ts'],
  },
  resizable: {
    name: 'resizable',
    files: ['resizable.component.ts'],
  },
  'scroll-area': {
    name: 'scroll-area',
    files: ['scroll-area.component.ts'],
    libFiles: ['touch.ts'],
  },
  select: {
    name: 'select',
    files: ['select.component.ts'],
  },
  separator: {
    name: 'separator',
    files: ['separator.component.ts'],
  },
  sheet: {
    name: 'sheet',
    files: ['sheet.component.ts'],
  },
  sidebar: {
    name: 'sidebar',
    files: ['sidebar.component.ts'],
    dependencies: ['scroll-area', 'tooltip'],
  },
  skeleton: {
    name: 'skeleton',
    files: ['skeleton.component.ts'],
  },
  slider: {
    name: 'slider',
    files: ['slider.component.ts'],
  },
  spinner: {
    name: 'spinner',
    files: ['spinner.component.ts'],
  },
  stepper: {
    name: 'stepper',
    files: ['stepper.component.ts'],
  },
  switch: {
    name: 'switch',
    files: ['switch.component.ts'],
  },
  table: {
    name: 'table',
    files: ['table.component.ts'],
  },
  tabs: {
    name: 'tabs',
    files: ['tabs.component.ts'],
  },
  textarea: {
    name: 'textarea',
    files: ['input-group.token.ts', 'textarea.component.ts'],
  },
  timeline: {
    name: 'timeline',
    files: ['timeline.component.ts'],
  },
  toast: {
    name: 'toast',
    files: ['toast.component.ts'],
  },
  toggle: {
    name: 'toggle',
    files: ['toggle.component.ts'],
  },
  'toggle-group': {
    name: 'toggle-group',
    files: ['toggle-group.component.ts']
  },
  tooltip: {
    name: 'tooltip',
    files: ['tooltip.component.ts'],
    libFiles: ['touch.ts'],
  },
  tree: {
    name: 'tree',
    files: ['tree.component.ts'],
    optionalDependencies: [
      { name: 'context-menu', description: 'Enables right-click context menus on tree nodes' },
    ],
  },
  'speed-dial': {
    name: 'speed-dial',
    files: ['speed-dial.component.ts']
  },
  'chip-list': {
    name: 'chip-list',
    files: ['chip-list.component.ts', 'input-group.token.ts'],
    dependencies: ['badge', 'button', 'input'],
  },
  'emoji-picker': {
    name: 'emoji-picker',
    files: ['emoji-data.ts', 'emoji-picker.component.ts'],
    dependencies: ['input', 'scroll-area', 'tooltip'],
  },
  'rich-text-editor': {
    name: 'rich-text-editor',
    files: ['rich-text-command-registry.service.ts', 'rich-text-editor.component.ts', 'rich-text-image-resizer.component.ts', 'rich-text-locales.ts', 'rich-text-markdown.service.ts', 'rich-text-mention.component.ts', 'rich-text-paste-normalizer.service.ts', 'rich-text-sanitizer.service.ts', 'rich-text-toolbar.component.ts'],
    dependencies: ['autocomplete', 'button', 'dialog', 'emoji-picker', 'popover', 'scroll-area', 'separator'],
    libFiles: ['parsers/docx-parser.ts', 'parsers/docx-to-editor-html.ts', 'parsers/image-validator.ts', 'parsers/inflate.ts', 'parsers/pdf-parser.ts', 'parsers/svg-sanitizer.ts', 'parsers/zip-reader.ts', 'shortcut-binding.service.ts', 'touch.ts'],
    shortcutDefinitions: [
      {
        exportName: 'RICH_TEXT_SHORTCUT_DEFINITIONS',
        componentName: 'rich-text-editor',
        sourceFile: 'rich-text-editor.component.ts',
      },
    ],
  },
  // Chart Components
  'pie-chart': {
    name: 'pie-chart',
    files: ['charts/chart.types.ts', 'charts/chart.utils.ts', 'charts/pie-chart.component.ts'],
  },
  'pie-chart-drilldown': {
    name: 'pie-chart-drilldown',
    files: ['charts/chart.types.ts', 'charts/chart.utils.ts', 'charts/pie-chart-drilldown.component.ts'],
  },
  'bar-chart': {
    name: 'bar-chart',
    files: ['charts/bar-chart.component.ts', 'charts/chart.types.ts', 'charts/chart.utils.ts'],
  },
  'bar-chart-drilldown': {
    name: 'bar-chart-drilldown',
    files: ['charts/bar-chart-drilldown.component.ts', 'charts/chart.types.ts', 'charts/chart.utils.ts'],
  },
  'stacked-bar-chart': {
    name: 'stacked-bar-chart',
    files: ['charts/chart.types.ts', 'charts/chart.utils.ts', 'charts/stacked-bar-chart.component.ts'],
  },
  'column-range-chart': {
    name: 'column-range-chart',
    files: ['charts/chart.types.ts', 'charts/chart.utils.ts', 'charts/column-range-chart.component.ts'],
  },
  'bar-race-chart': {
    name: 'bar-race-chart',
    files: ['charts/bar-race-chart.component.ts', 'charts/chart.types.ts', 'charts/chart.utils.ts'],
  },
  'org-chart': {
    name: 'org-chart',
    files: ['charts/chart.types.ts', 'charts/chart.utils.ts', 'charts/org-chart.component.ts'],
  },
  'bento-grid': {
    name: 'bento-grid',
    dependencies: ['component-outlet', 'context-menu'],
    files: ['bento-grid.component.ts'],
    libFiles: ['touch.ts'],
  },
  'page-builder': {
    name: 'page-builder',
    dependencies: ['bento-grid', 'icon', 'select', 'switch'],
    files: ['page-builder/page-builder.component.ts', 'page-builder/page-builder.types.ts', 'page-builder/property-editor.component.ts'],
  },
  'page-renderer': {
    name: 'page-renderer',
    dependencies: ['bento-grid'],
    files: ['page-builder/page-builder.types.ts', 'page-builder/page-renderer.component.ts'],
  },
  'component-outlet': {
    name: 'component-outlet',
    files: ['component-outlet.directive.ts', 'data-table/component-pool.service.ts'],
  },
  'split-button': {
    name: 'split-button',
    files: ['split-button.component.ts'],
    dependencies: ['button'],
  },
  // Animations
  'gradient-text': {
    name: 'gradient-text',
    files: ['gradient-text.component.ts'],
  },
  'flip-text': {
    name: 'flip-text',
    files: ['flip-text.component.ts'],
  },
  meteors: {
    name: 'meteors',
    files: ['meteors.component.ts'],
  },
  'shine-border': {
    name: 'shine-border',
    files: ['shine-border.component.ts'],
  },
  'scroll-progress': {
    name: 'scroll-progress',
    files: ['scroll-progress.component.ts'],
  },
  'blur-fade': {
    name: 'blur-fade',
    files: ['blur-fade.component.ts'],
  },
  ripple: {
    name: 'ripple',
    files: ['ripple.directive.ts'],
  },
  marquee: {
    name: 'marquee',
    files: ['marquee.component.ts'],
  },
  'word-rotate': {
    name: 'word-rotate',
    files: ['word-rotate.component.ts'],
  },
  'morphing-text': {
    name: 'morphing-text',
    files: ['morphing-text.component.ts'],
  },
  'typing-animation': {
    name: 'typing-animation',
    files: ['typing-animation.component.ts'],
  },
  'wobble-card': {
    name: 'wobble-card',
    files: ['wobble-card.component.ts'],
  },
  magnetic: {
    name: 'magnetic',
    files: ['magnetic.directive.ts'],
  },
  orbit: {
    name: 'orbit',
    files: ['orbit.component.ts'],
  },
  'stagger-children': {
    name: 'stagger-children',
    files: ['stagger-children.component.ts'],
  },
  particles: {
    name: 'particles',
    files: ['particles.component.ts'],
  },
  kanban: {
    name: 'kanban',
    files: ['kanban-locales.ts', 'kanban.component.ts'],
    libFiles: ['shortcut-binding.service.ts', 'touch.ts'],
    dependencies: ['alert-dialog', 'autocomplete', 'avatar', 'badge', 'button', 'chip-list', 'context-menu', 'dialog', 'input', 'label', 'scroll-area', 'separator', 'textarea'],
  },
  'shortcut-bindings-dialog': {
    name: 'shortcut-bindings-dialog',
    files: ['shortcut-bindings-dialog.component.ts'],
    libFiles: ['shortcut-binding.service.ts'],
    dependencies: ['accordion', 'badge', 'button', 'dialog', 'scroll-area'],
  },
  tour: {
    name: 'tour',
    files: ['tour.component.ts'],
    dependencies: ['button'],
  },
  'comparison-slider': {
    name: 'comparison-slider',
    files: ['comparison-slider.component.ts'],
    libFiles: ['touch.ts'],
  },
  sortable: {
    name: 'sortable',
    files: ['sortable.component.ts'],
    libFiles: ['touch.ts'],
  },
});

export type ComponentName = keyof typeof registry;

export function isComponentName(name: string): name is ComponentName {
    return name in registry;
}

export function getComponentNames(): ComponentName[] {
    return Object.keys(registry) as ComponentName[];
}
