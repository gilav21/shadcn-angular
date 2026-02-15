// Component Registry - Defines available components and their file mappings
// Actual component files are stored in packages/components/ui/

export interface ComponentDefinition {
  name: string;
  files: string[]; // Relative paths to component files
  category: string; // UI category for discoverability
  dependencies?: string[]; // Other components this depends on
  npmDependencies?: string[]; // NPM packages this depends on
  shortcutDefinitions?: {
    exportName: string;
    componentName: string;
    sourceFile: string;
  }[];
}

export type ComponentName = keyof typeof registry;

// Registry maps component names to their file definitions
// Files are relative to the components/ui directory
export const registry: Record<string, ComponentDefinition> = {
  accordion: {
    name: 'accordion',
    category: 'layout',
    files: ['accordion.component.ts'],
  },
  autocomplete: {
    name: 'autocomplete',
    category: 'forms',
    files: ['autocomplete.component.ts', 'highlight.pipe.ts'],
    dependencies: ['popover', 'command', 'badge'],
  },
  alert: {
    name: 'alert',
    category: 'feedback',
    files: ['alert.component.ts'],
  },
  'alert-dialog': {
    name: 'alert-dialog',
    category: 'overlay',
    files: ['alert-dialog.component.ts'],
  },
  'aspect-ratio': {
    name: 'aspect-ratio',
    category: 'layout',
    files: ['aspect-ratio.component.ts'],
  },
  avatar: {
    name: 'avatar',
    category: 'data-display',
    files: ['avatar.component.ts'],
  },
  badge: {
    name: 'badge',
    category: 'data-display',
    files: ['badge.component.ts'],
  },
  breadcrumb: {
    name: 'breadcrumb',
    category: 'layout',
    files: ['breadcrumb.component.ts'],
  },
  button: {
    name: 'button',
    category: 'actions',
    files: ['button.component.ts'],
  },
  'button-group': {
    name: 'button-group',
    category: 'actions',
    files: ['button-group.component.ts'],
    dependencies: ['button']
  },
  calendar: {
    name: 'calendar',
    category: 'forms',
    files: ['calendar.component.ts', 'calendar-locales.ts'],
    dependencies: ['button', 'select'],
  },
  card: {
    name: 'card',
    category: 'layout',
    files: ['card.component.ts'],
  },
  carousel: {
    name: 'carousel',
    category: 'data-display',
    files: ['carousel.component.ts'],
  },
  checkbox: {
    name: 'checkbox',
    category: 'forms',
    files: ['checkbox.component.ts'],
  },
  collapsible: {
    name: 'collapsible',
    category: 'layout',
    files: ['collapsible.component.ts'],
  },
  'color-picker': {
    name: 'color-picker',
    category: 'forms',
    files: ['color-picker.component.ts'],
    dependencies: ['popover', 'input', 'tabs'],
  },
  confetti: {
    name: 'confetti',
    category: 'directives',
    files: ['confetti.directive.ts'],
  },
  command: {
    name: 'command',
    category: 'overlay',
    files: ['command.component.ts'],
    dependencies: ['dialog'],
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
    category: 'overlay',
    files: ['context-menu.component.ts', 'context-menu-integrations.ts'],
  },
  'date-picker': {
    name: 'date-picker',
    category: 'forms',
    files: ['date-picker.component.ts'],
    dependencies: ['calendar'],
  },
  chat: {
    name: 'chat',
    category: 'ai',
    files: ['chat.component.ts'],
    dependencies: ['avatar', 'button', 'textarea', 'scroll-area'],
  },
  'streaming-text': {
    name: 'streaming-text',
    category: 'ai',
    files: ['streaming-text.component.ts'],
  },
  sparkles: {
    name: 'sparkles',
    category: 'ai',
    files: ['sparkles.component.ts'],
    dependencies: ['button'],
  },
  'code-block': {
    name: 'code-block',
    category: 'editors',
    files: ['code-block.component.ts'],
    dependencies: ['button', 'scroll-area'],
  },
  'text-reveal': {
    name: 'text-reveal',
    category: 'editors',
    files: ['text-reveal.component.ts'],
  },
  'data-table': {
    name: 'data-table',
    category: 'data-display',
    files: [
      'data-table/data-table.component.ts',
      'data-table/data-table-column-header.component.ts',
      'data-table/data-table-pagination.component.ts',
      'data-table/data-table.types.ts',
      'data-table/index.ts',
    ],
    dependencies: [
      'table',
      'input',
      'button',
      'checkbox',
      'select',
      'pagination',
      'popover',
      'component-outlet',
      'icon',
    ],
  },
  dialog: {
    name: 'dialog',
    category: 'overlay',
    files: ['dialog.component.ts'],
  },
  dock: {
    name: 'dock',
    category: 'actions',
    files: [
      'dock.component.ts',
      'dock-item.component.ts',
      'dock-icon.component.ts',
      'dock-label.component.ts',
    ],
    dependencies: ['icon'],
  },
  'tree-select': {
    name: 'tree-select',
    category: 'forms',
    files: ['tree-select.component.ts'],
    dependencies: ['popover', 'tree', 'icon'],
  },
  'virtual-scroll': {
    name: 'virtual-scroll',
    category: 'layout',
    files: ['virtual-scroll.component.ts'],
  },
  'input-mask': {
    name: 'input-mask',
    category: 'directives',
    files: ['input-mask.directive.ts'],
    dependencies: ['input'],
  },
  drawer: {
    name: 'drawer',
    category: 'overlay',
    files: ['drawer.component.ts'],
  },
  'dropdown-menu': {
    name: 'dropdown-menu',
    category: 'overlay',
    files: ['dropdown-menu.component.ts'],
  },
  empty: {
    name: 'empty',
    category: 'feedback',
    files: ['empty.component.ts'],
  },
  field: {
    name: 'field',
    category: 'forms',
    files: ['field.component.ts'],
  },
  icon: {
    name: 'icon',
    category: 'data-display',
    files: ['icon.component.ts'],
  },

  'file-upload': {
    name: 'file-upload',
    category: 'forms',
    files: ['file-upload.component.ts'],
    dependencies: ['button', 'progress'],
  },
  'hover-card': {
    name: 'hover-card',
    category: 'overlay',
    files: ['hover-card.component.ts'],
  },
  input: {
    name: 'input',
    category: 'forms',
    files: ['input.component.ts'],
  },
  'input-group': {
    name: 'input-group',
    category: 'forms',
    files: ['input-group.component.ts', 'input-group.token.ts'],
    dependencies: ['input'],
  },
  'input-otp': {
    name: 'input-otp',
    category: 'forms',
    files: ['input-otp.component.ts'],
  },
  kbd: {
    name: 'kbd',
    category: 'data-display',
    files: ['kbd.component.ts'],
  },
  label: {
    name: 'label',
    category: 'forms',
    files: ['label.component.ts'],
  },
  menubar: {
    name: 'menubar',
    category: 'overlay',
    files: ['menubar.component.ts'],
  },
  'native-select': {
    name: 'native-select',
    category: 'forms',
    files: ['native-select.component.ts'],
  },
  'navigation-menu': {
    name: 'navigation-menu',
    category: 'layout',
    files: ['navigation-menu.component.ts'],
  },
  'number-ticker': {
    name: 'number-ticker',
    category: 'data-display',
    files: ['number-ticker.component.ts'],
  },
  pagination: {
    name: 'pagination',
    category: 'data-display',
    files: ['pagination.component.ts'],
  },
  popover: {
    name: 'popover',
    category: 'overlay',
    files: ['popover.component.ts'],
  },
  progress: {
    name: 'progress',
    category: 'feedback',
    files: ['progress.component.ts'],
  },
  'radio-group': {
    name: 'radio-group',
    category: 'forms',
    files: ['radio-group.component.ts'],
  },
  rating: {
    name: 'rating',
    category: 'forms',
    files: ['rating.component.ts'],
  },
  resizable: {
    name: 'resizable',
    category: 'layout',
    files: ['resizable.component.ts'],
  },
  'scroll-area': {
    name: 'scroll-area',
    category: 'layout',
    files: ['scroll-area.component.ts'],
  },
  select: {
    name: 'select',
    category: 'forms',
    files: ['select.component.ts'],
  },
  separator: {
    name: 'separator',
    category: 'layout',
    files: ['separator.component.ts'],
  },
  sheet: {
    name: 'sheet',
    category: 'overlay',
    files: ['sheet.component.ts'],
  },
  sidebar: {
    name: 'sidebar',
    category: 'layout',
    files: ['sidebar.component.ts'],
    dependencies: ['scroll-area', 'tooltip', 'icon'],
  },
  skeleton: {
    name: 'skeleton',
    category: 'feedback',
    files: ['skeleton.component.ts'],
  },
  slider: {
    name: 'slider',
    category: 'forms',
    files: ['slider.component.ts'],
  },
  spinner: {
    name: 'spinner',
    category: 'feedback',
    files: ['spinner.component.ts'],
  },
  stepper: {
    name: 'stepper',
    category: 'data-display',
    files: ['stepper.component.ts'],
  },
  switch: {
    name: 'switch',
    category: 'forms',
    files: ['switch.component.ts'],
  },
  table: {
    name: 'table',
    category: 'data-display',
    files: ['table.component.ts'],
  },
  tabs: {
    name: 'tabs',
    category: 'layout',
    files: ['tabs.component.ts'],
  },
  textarea: {
    name: 'textarea',
    category: 'forms',
    files: ['textarea.component.ts'],
  },
  timeline: {
    name: 'timeline',
    category: 'data-display',
    files: ['timeline.component.ts'],
  },
  toast: {
    name: 'toast',
    category: 'overlay',
    files: ['toast.component.ts'],
  },
  toggle: {
    name: 'toggle',
    category: 'actions',
    files: ['toggle.component.ts'],
  },
  'toggle-group': {
    name: 'toggle-group',
    category: 'actions',
    files: ['toggle-group.component.ts']
  },
  tooltip: {
    name: 'tooltip',
    category: 'overlay',
    files: ['tooltip.component.ts'],
  },
  tree: {
    name: 'tree',
    category: 'data-display',
    files: ['tree.component.ts'],
    dependencies: ['icon'],
  },
  'speed-dial': {
    name: 'speed-dial',
    category: 'actions',
    files: ['speed-dial.component.ts'],
    dependencies: ['button']
  },
  'chip-list': {
    name: 'chip-list',
    category: 'forms',
    files: ['chip-list.component.ts'],
    dependencies: ['badge', 'button', 'input', 'input-group'],
  },
  'emoji-picker': {
    name: 'emoji-picker',
    category: 'forms',
    files: ['emoji-picker.component.ts', 'emoji-data.ts'],
    dependencies: ['button', 'input', 'scroll-area', 'popover'],
  },
  'rich-text-editor': {
    name: 'rich-text-editor',
    category: 'editors',
    files: [
      'rich-text-editor.component.ts',
      'rich-text-toolbar.component.ts',
      'rich-text-sanitizer.service.ts',
      'rich-text-markdown.service.ts',
      'rich-text-mention.component.ts',
      'rich-text-image-resizer.component.ts',
    ],
    dependencies: [
      'button',
      'separator',
      'popover',
      'emoji-picker',
      'select',
      'input',
      'scroll-area',
    ],
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
    category: 'charts',
    files: [
      'charts/pie-chart.component.ts',
      'charts/chart.types.ts',
      'charts/chart.utils.ts',
    ],
  },
  'pie-chart-drilldown': {
    name: 'pie-chart-drilldown',
    category: 'charts',
    files: [
      'charts/pie-chart-drilldown.component.ts',
      'charts/chart.types.ts',
      'charts/chart.utils.ts',
    ],
  },
  'bar-chart': {
    name: 'bar-chart',
    category: 'charts',
    files: [
      'charts/bar-chart.component.ts',
      'charts/chart.types.ts',
      'charts/chart.utils.ts',
    ],
  },
  'bar-chart-drilldown': {
    name: 'bar-chart-drilldown',
    category: 'charts',
    files: [
      'charts/bar-chart-drilldown.component.ts',
      'charts/chart.types.ts',
      'charts/chart.utils.ts',
    ],
  },
  'stacked-bar-chart': {
    name: 'stacked-bar-chart',
    category: 'charts',
    files: [
      'charts/stacked-bar-chart.component.ts',
      'charts/chart.types.ts',
      'charts/chart.utils.ts',
    ],
  },
  'column-range-chart': {
    name: 'column-range-chart',
    category: 'charts',
    files: [
      'charts/column-range-chart.component.ts',
      'charts/chart.types.ts',
      'charts/chart.utils.ts',
    ],
  },
  'bar-race-chart': {
    name: 'bar-race-chart',
    category: 'charts',
    files: [
      'charts/bar-race-chart.component.ts',
      'charts/chart.types.ts',
      'charts/chart.utils.ts',
    ],
  },
  'org-chart': {
    name: 'org-chart',
    category: 'charts',
    files: [
      'charts/org-chart.component.ts',
      'charts/chart.types.ts',
      'charts/chart.utils.ts',
    ],
  },
  'bento-grid': {
    name: 'bento-grid',
    category: 'layout',
    dependencies: ['context-menu', 'component-outlet', 'icon'],
    files: [
      'bento-grid.component.ts',
    ],
  },
  'page-builder': {
    name: 'page-builder',
    category: 'layout',
    dependencies: [
      'bento-grid',
      'button',
      'input',
      'label',
      'select',
      'switch',
      'slider',
      'icon'
    ],
    files: [
      'page-builder/page-builder.component.ts',
      'page-builder/page-builder.types.ts',
      'page-builder/property-editor.component.ts',
      'page-builder/page-renderer.component.ts'
    ],
  },
  'component-outlet': {
    name: 'component-outlet',
    category: 'directives',
    files: ['component-outlet.directive.ts'],
  },
  'split-button': {
    name: 'split-button',
    category: 'actions',
    files: ['split-button.component.ts'],
    dependencies: ['button', 'dropdown-menu'],
  },
};
