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
    files: ['autocomplete/autocomplete.component.html', 'autocomplete/autocomplete.component.ts', 'autocomplete/highlight.pipe.ts', 'autocomplete/index.ts'],
    dependencies: ['badge', 'command', 'popover'],
  },
  alert: {
    name: 'alert',
    files: ['alert/alert.component.html', 'alert/alert.component.ts', 'alert/index.ts', 'alert/sub/alert-description.component.html', 'alert/sub/alert-description.component.ts', 'alert/sub/alert-title.component.html', 'alert/sub/alert-title.component.ts'],
  },
  'alert-dialog': {
    name: 'alert-dialog',
    files: ['alert-dialog/alert-dialog.component.ts', 'alert-dialog/index.ts', 'alert-dialog/sub/alert-dialog-action.component.ts', 'alert-dialog/sub/alert-dialog-cancel.component.ts', 'alert-dialog/sub/alert-dialog-content.component.ts', 'alert-dialog/sub/alert-dialog-description.component.ts', 'alert-dialog/sub/alert-dialog-footer.component.ts', 'alert-dialog/sub/alert-dialog-header.component.ts', 'alert-dialog/sub/alert-dialog-title.component.ts', 'alert-dialog/sub/alert-dialog-trigger.component.ts'],
  },
  'aspect-ratio': {
    name: 'aspect-ratio',
    files: ['aspect-ratio/aspect-ratio.component.html', 'aspect-ratio/aspect-ratio.component.ts', 'aspect-ratio/index.ts'],
  },
  avatar: {
    name: 'avatar',
    files: ['avatar/avatar.component.html', 'avatar/avatar.component.ts', 'avatar/index.ts', 'avatar/sub/avatar-fallback.component.html', 'avatar/sub/avatar-fallback.component.ts', 'avatar/sub/avatar-image.component.html', 'avatar/sub/avatar-image.component.ts'],
  },
  badge: {
    name: 'badge',
    files: ['badge/badge.component.html', 'badge/badge.component.ts', 'badge/index.ts'],
  },
  breadcrumb: {
    name: 'breadcrumb',
    files: ['breadcrumb/breadcrumb.component.ts', 'breadcrumb/index.ts', 'breadcrumb/sub/breadcrumb-ellipsis.component.ts', 'breadcrumb/sub/breadcrumb-item.component.ts', 'breadcrumb/sub/breadcrumb-link.component.ts', 'breadcrumb/sub/breadcrumb-list.component.ts', 'breadcrumb/sub/breadcrumb-page.component.ts', 'breadcrumb/sub/breadcrumb-separator.component.ts'],
  },
  button: {
    name: 'button',
    files: ['button/button.component.html', 'button/button.component.ts', 'button/index.ts'],
    dependencies: ['ripple'],
  },
  'button-group': {
    name: 'button-group',
    files: ['button-group/button-group.component.html', 'button-group/button-group.component.ts', 'button-group/index.ts', 'button-group/sub/button-group-separator.component.ts', 'button-group/sub/button-group-text.component.ts']
  },
  calendar: {
    name: 'calendar',
    files: ['calendar/calendar.component.html', 'calendar/calendar.component.ts', 'calendar/index.ts'],
    libFiles: ['calendar-locales.ts'],
    dependencies: ['button', 'select'],
  },
  card: {
    name: 'card',
    files: ['card/card.component.ts', 'card/index.ts', 'card/sub/card-content.component.ts', 'card/sub/card-description.component.ts', 'card/sub/card-footer.component.ts', 'card/sub/card-header.component.ts', 'card/sub/card-title.component.ts'],
  },
  carousel: {
    name: 'carousel',
    files: ['carousel/carousel.component.ts', 'carousel/index.ts', 'carousel/sub/carousel-content.component.ts', 'carousel/sub/carousel-item.component.ts', 'carousel/sub/carousel-next.component.ts', 'carousel/sub/carousel-previous.component.ts'],
  },
  checkbox: {
    name: 'checkbox',
    files: ['checkbox/checkbox.component.html', 'checkbox/checkbox.component.ts', 'checkbox/index.ts'],
  },
  collapsible: {
    name: 'collapsible',
    files: ['collapsible/collapsible.component.ts', 'collapsible/index.ts', 'collapsible/sub/collapsible-content.component.ts', 'collapsible/sub/collapsible-trigger.component.ts'],
  },
  'color-picker': {
    name: 'color-picker',
    files: ['color-picker/color-picker.component.html', 'color-picker/color-picker.component.ts', 'color-picker/index.ts'],
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
    files: ['date-picker/date-picker.component.html', 'date-picker/date-picker.component.ts', 'date-picker/index.ts', 'date-picker/sub/date-range-picker.component.html', 'date-picker/sub/date-range-picker.component.ts'],
    dependencies: ['calendar'],
  },
  chat: {
    name: 'chat',
    files: ['chat/chat.component.html', 'chat/chat.component.ts', 'chat/index.ts', 'chat/sub/chat-input.component.ts', 'chat/sub/chat-list.component.ts'],
    dependencies: ['avatar', 'button', 'scroll-area', 'textarea'],
  },
  'streaming-text': {
    name: 'streaming-text',
    files: ['streaming-text/index.ts', 'streaming-text/streaming-text.component.html', 'streaming-text/streaming-text.component.ts'],
  },
  sparkles: {
    name: 'sparkles',
    files: ['sparkles/index.ts', 'sparkles/sparkles.component.css', 'sparkles/sparkles.component.html', 'sparkles/sparkles.component.ts', 'sparkles/sub/sparkles-button.component.html', 'sparkles/sub/sparkles-button.component.ts'],
    dependencies: ['button'],
  },
  'code-block': {
    name: 'code-block',
    files: ['code-block/code-block.component.html', 'code-block/code-block.component.ts', 'code-block/index.ts'],
    libFiles: ['code-scopes.ts'],
    dependencies: ['button'],
  },
  'text-reveal': {
    name: 'text-reveal',
    files: ['text-reveal/index.ts', 'text-reveal/text-reveal.component.css', 'text-reveal/text-reveal.component.html', 'text-reveal/text-reveal.component.ts'],
  },
  'data-table': {
    name: 'data-table',
    files: ['data-table/component-pool.service.ts', 'data-table/data-table-column-builder.ts', 'data-table/data-table.component.html', 'data-table/data-table.component.ts', 'data-table/data-table.types.ts', 'data-table/data-table.utils.ts', 'data-table/index.ts', 'data-table/sub/data-table-column-header.component.html', 'data-table/sub/data-table-column-header.component.ts', 'data-table/sub/data-table-date-filter.component.html', 'data-table/sub/data-table-date-filter.component.ts', 'data-table/sub/data-table-date-range-filter.component.html', 'data-table/sub/data-table-date-range-filter.component.ts', 'data-table/sub/data-table-date-utils.ts', 'data-table/sub/data-table-multiselect-filter.component.html', 'data-table/sub/data-table-multiselect-filter.component.ts', 'data-table/sub/data-table-pagination.component.html', 'data-table/sub/data-table-pagination.component.ts'],
    peerFiles: [
      'context-menu-integrations.ts',
    ],
    dependencies: ['badge', 'button', 'calendar', 'checkbox', 'command', 'component-outlet', 'context-menu', 'icon', 'input', 'pagination', 'popover', 'select', 'table'],
    libFiles: ['calendar-locales.ts', 'parsers/xlsx.ts', 'touch.ts'],
    optionalDependencies: [
      { name: 'context-menu', description: 'Enables right-click context menus on rows and headers' },
    ],
  },
  dialog: {
    name: 'dialog',
    files: ['dialog/dialog.component.ts', 'dialog/index.ts', 'dialog/sub/dialog-content.component.html', 'dialog/sub/dialog-content.component.ts', 'dialog/sub/dialog-description.component.ts', 'dialog/sub/dialog-footer.component.ts', 'dialog/sub/dialog-header.component.ts', 'dialog/sub/dialog-title.component.ts', 'dialog/sub/dialog-trigger.component.ts'],
  },
  dock: {
    name: 'dock',
    files: ['dock/dock.component.html', 'dock/dock.component.ts', 'dock/index.ts', 'dock/sub/dock-icon.component.html', 'dock/sub/dock-icon.component.ts', 'dock/sub/dock-item.component.html', 'dock/sub/dock-item.component.ts', 'dock/sub/dock-label.component.html', 'dock/sub/dock-label.component.ts'],
  },
  'tree-select': {
    name: 'tree-select',
    files: ['tree-select/index.ts', 'tree-select/sub/tree-select-content.component.ts', 'tree-select/sub/tree-select-trigger.component.ts', 'tree-select/tree-select.component.css', 'tree-select/tree-select.component.html', 'tree-select/tree-select.component.ts'],
    dependencies: ['popover', 'tree'],
  },
  'virtual-scroll': {
    name: 'virtual-scroll',
    files: ['virtual-scroll/index.ts', 'virtual-scroll/virtual-scroll.component.css', 'virtual-scroll/virtual-scroll.component.html', 'virtual-scroll/virtual-scroll.component.ts'],
  },
  'input-mask': {
    name: 'input-mask',
    files: ['input-mask.directive.ts'],
    dependencies: ['input'],
  },
  drawer: {
    name: 'drawer',
    files: ['drawer/drawer.component.ts', 'drawer/index.ts', 'drawer/sub/drawer-close.component.ts', 'drawer/sub/drawer-content.component.html', 'drawer/sub/drawer-content.component.ts', 'drawer/sub/drawer-description.component.ts', 'drawer/sub/drawer-footer.component.ts', 'drawer/sub/drawer-header.component.ts', 'drawer/sub/drawer-title.component.ts', 'drawer/sub/drawer-trigger.component.ts'],
  },
  'dropdown-menu': {
    name: 'dropdown-menu',
    files: ['dropdown-menu.component.ts'],
    libFiles: ['touch.ts'],
  },
  empty: {
    name: 'empty',
    files: ['empty/empty.component.ts', 'empty/index.ts', 'empty/sub/empty-content.component.ts', 'empty/sub/empty-description.component.ts', 'empty/sub/empty-header.component.ts', 'empty/sub/empty-media.component.ts', 'empty/sub/empty-title.component.ts'],
  },
  field: {
    name: 'field',
    files: ['field/field.component.ts', 'field/field.utils.ts', 'field/index.ts', 'field/sub/field-description.component.ts', 'field/sub/field-error.component.ts', 'field/sub/field-group.component.ts', 'field/sub/field-label.component.ts', 'field/sub/field-legend.component.ts', 'field/sub/field-separator.component.ts', 'field/sub/field-set.component.ts'],
  },
  icon: {
    name: 'icon',
    files: ['icon/icon.component.css', 'icon/icon.component.html', 'icon/icon.component.ts', 'icon/icon.token.ts', 'icon/index.ts'],
  },

  'file-upload': {
    name: 'file-upload',
    files: ['file-upload/file-upload.component.html', 'file-upload/file-upload.component.ts', 'file-upload/index.ts'],
    dependencies: ['button', 'progress'],
  },
  'file-viewer': {
    name: 'file-viewer',
    files: ['file-viewer/file-viewer.component.css', 'file-viewer/file-viewer.component.html', 'file-viewer/file-viewer.component.ts', 'file-viewer/index.ts'],
    dependencies: ['spinner'],
    libFiles: ['parsers/doc-enhanced-parser.ts', 'parsers/docx-parser.ts', 'parsers/file-type-detector.ts', 'parsers/image-validator.ts', 'parsers/inflate.ts', 'parsers/ole2-reader.ts', 'parsers/pdf-parser.ts', 'parsers/pdf-pixel-perfect.ts', 'parsers/ppt-parser.ts', 'parsers/pptx-parser.ts', 'parsers/svg-sanitizer.ts', 'parsers/ttf-builder.ts', 'parsers/ttf-parser.ts', 'parsers/xlsx-reader.ts', 'parsers/zip-reader.ts'],
  },
  'hover-card': {
    name: 'hover-card',
    files: ['hover-card/hover-card.component.ts', 'hover-card/index.ts', 'hover-card/sub/hover-card-content.component.ts', 'hover-card/sub/hover-card-trigger.component.ts'],
    libFiles: ['touch.ts'],
  },
  input: {
    name: 'input',
    files: ['input/index.ts', 'input/input.component.html', 'input/input.component.ts'],
    libFiles: ['input-group.token.ts'],
  },
  'input-group': {
    name: 'input-group',
    files: ['input-group/index.ts', 'input-group/input-group.component.html', 'input-group/input-group.component.ts', 'input-group/sub/input-group-addon.component.html', 'input-group/sub/input-group-addon.component.ts', 'input-group/sub/input-group-input.component.html', 'input-group/sub/input-group-input.component.ts', 'input-group/sub/input-group-text.component.html', 'input-group/sub/input-group-text.component.ts'],
    libFiles: ['input-group.token.ts'],
  },
  'input-otp': {
    name: 'input-otp',
    files: ['input-otp/index.ts', 'input-otp/input-otp.component.ts', 'input-otp/sub/input-otp-group.component.ts', 'input-otp/sub/input-otp-separator.component.ts', 'input-otp/sub/input-otp-slot.component.ts'],
  },
  kbd: {
    name: 'kbd',
    files: ['kbd/index.ts', 'kbd/kbd.component.html', 'kbd/kbd.component.ts'],
  },
  label: {
    name: 'label',
    files: ['label/index.ts', 'label/label.component.html', 'label/label.component.ts'],
  },
  menubar: {
    name: 'menubar',
    files: ['menubar.component.ts'],
    libFiles: ['touch.ts'],
  },
  'native-select': {
    name: 'native-select',
    files: ['native-select/index.ts', 'native-select/native-select.component.html', 'native-select/native-select.component.ts'],
  },
  'navigation-menu': {
    name: 'navigation-menu',
    files: ['navigation-menu/index.ts', 'navigation-menu/navigation-menu.component.html', 'navigation-menu/navigation-menu.component.ts', 'navigation-menu/navigation-menu.service.ts', 'navigation-menu/sub/navigation-menu-content.component.ts', 'navigation-menu/sub/navigation-menu-indicator.component.ts', 'navigation-menu/sub/navigation-menu-item.component.ts', 'navigation-menu/sub/navigation-menu-link.component.ts', 'navigation-menu/sub/navigation-menu-list.component.ts', 'navigation-menu/sub/navigation-menu-trigger.component.ts'],
    libFiles: ['touch.ts'],
  },
  'number-input': {
    name: 'number-input',
    files: ['number-input/index.ts', 'number-input/number-input.component.html', 'number-input/number-input.component.ts'],
    libFiles: ['input-group.token.ts'],
    dependencies: ['input'],
  },
  'number-ticker': {
    name: 'number-ticker',
    files: ['number-ticker/index.ts', 'number-ticker/number-ticker.component.html', 'number-ticker/number-ticker.component.ts', 'number-ticker/sub/number-ticker-digit.component.html', 'number-ticker/sub/number-ticker-digit.component.ts'],
  },
  pagination: {
    name: 'pagination',
    files: ['pagination/index.ts', 'pagination/pagination.component.ts', 'pagination/sub/pagination-content.component.ts', 'pagination/sub/pagination-ellipsis.component.ts', 'pagination/sub/pagination-item.component.ts', 'pagination/sub/pagination-link.component.ts', 'pagination/sub/pagination-next.component.ts', 'pagination/sub/pagination-previous.component.ts'],
  },
  'phone-input': {
    name: 'phone-input',
    files: ['phone-input/index.ts', 'phone-input/phone-input-data.ts', 'phone-input/phone-input.component.html', 'phone-input/phone-input.component.ts'],
    libFiles: ['input-group.token.ts'],
    dependencies: ['input', 'input-group', 'input-mask', 'popover'],
  },
  popover: {
    name: 'popover',
    files: ['popover/index.ts', 'popover/popover.component.ts', 'popover/sub/popover-close.component.ts', 'popover/sub/popover-content.component.ts', 'popover/sub/popover-trigger.component.ts'],
  },
  progress: {
    name: 'progress',
    files: ['progress/index.ts', 'progress/progress.component.html', 'progress/progress.component.ts'],
  },
  'radio-group': {
    name: 'radio-group',
    files: ['radio-group/index.ts', 'radio-group/radio-group.component.html', 'radio-group/radio-group.component.ts', 'radio-group/sub/radio-group-item.component.html', 'radio-group/sub/radio-group-item.component.ts'],
  },
  rating: {
    name: 'rating',
    files: ['rating/index.ts', 'rating/rating.component.html', 'rating/rating.component.ts'],
    libFiles: ['touch.ts'],
  },
  resizable: {
    name: 'resizable',
    files: ['resizable/index.ts', 'resizable/resizable.component.html', 'resizable/resizable.component.ts', 'resizable/sub/resizable-handle.component.ts', 'resizable/sub/resizable-panel.component.ts'],
  },
  'scroll-area': {
    name: 'scroll-area',
    files: ['scroll-area/index.ts', 'scroll-area/scroll-area.component.html', 'scroll-area/scroll-area.component.ts'],
    libFiles: ['touch.ts'],
  },
  select: {
    name: 'select',
    files: ['select.component.ts'],
  },
  separator: {
    name: 'separator',
    files: ['separator/index.ts', 'separator/separator.component.ts'],
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
    files: ['skeleton/index.ts', 'skeleton/skeleton.component.css', 'skeleton/skeleton.component.ts'],
  },
  slider: {
    name: 'slider',
    files: ['slider/index.ts', 'slider/slider.component.html', 'slider/slider.component.ts'],
  },
  spinner: {
    name: 'spinner',
    files: ['spinner/index.ts', 'spinner/spinner.component.html', 'spinner/spinner.component.ts', 'spinner/sub/page-spinner.component.html', 'spinner/sub/page-spinner.component.ts'],
  },
  stepper: {
    name: 'stepper',
    files: ['stepper/index.ts', 'stepper/stepper.component.html', 'stepper/stepper.component.ts', 'stepper/sub/stepper-content.component.ts', 'stepper/sub/stepper-description.component.ts', 'stepper/sub/stepper-item.component.ts', 'stepper/sub/stepper-separator.component.ts', 'stepper/sub/stepper-title.component.ts', 'stepper/sub/stepper-trigger.component.ts'],
  },
  switch: {
    name: 'switch',
    files: ['switch/index.ts', 'switch/switch.component.html', 'switch/switch.component.ts'],
  },
  table: {
    name: 'table',
    files: ['table.component.ts'],
  },
  tabs: {
    name: 'tabs',
    files: ['tabs/index.ts', 'tabs/sub/tabs-content.component.ts', 'tabs/sub/tabs-list.component.ts', 'tabs/sub/tabs-trigger.component.ts', 'tabs/tabs.component.ts'],
  },
  textarea: {
    name: 'textarea',
    files: ['textarea/index.ts', 'textarea/textarea.component.html', 'textarea/textarea.component.ts'],
    libFiles: ['input-group.token.ts'],
  },
  timeline: {
    name: 'timeline',
    files: ['timeline/index.ts', 'timeline/sub/timeline-connector.component.ts', 'timeline/sub/timeline-content.component.ts', 'timeline/sub/timeline-description.component.ts', 'timeline/sub/timeline-dot.component.ts', 'timeline/sub/timeline-header.component.ts', 'timeline/sub/timeline-item.component.ts', 'timeline/sub/timeline-time.component.ts', 'timeline/sub/timeline-title.component.ts', 'timeline/timeline.component.ts'],
  },
  toast: {
    name: 'toast',
    files: ['toast/index.ts', 'toast/sub/toaster.component.html', 'toast/sub/toaster.component.ts', 'toast/toast.component.html', 'toast/toast.component.ts'],
  },
  toggle: {
    name: 'toggle',
    files: ['toggle/index.ts', 'toggle/toggle.component.html', 'toggle/toggle.component.ts'],
  },
  'toggle-group': {
    name: 'toggle-group',
    files: ['toggle-group/index.ts', 'toggle-group/sub/toggle-group-item.component.html', 'toggle-group/sub/toggle-group-item.component.ts', 'toggle-group/toggle-group.component.html', 'toggle-group/toggle-group.component.ts']
  },
  tooltip: {
    name: 'tooltip',
    files: ['tooltip/index.ts', 'tooltip/sub/tooltip-content.component.html', 'tooltip/sub/tooltip-content.component.ts', 'tooltip/sub/tooltip-trigger.component.ts', 'tooltip/sub/tooltip.directive.ts', 'tooltip/tooltip.component.ts'],
    libFiles: ['touch.ts'],
  },
  tree: {
    name: 'tree',
    files: ['tree/index.ts', 'tree/sub/tree-icon.component.html', 'tree/sub/tree-icon.component.ts', 'tree/sub/tree-item.component.html', 'tree/sub/tree-item.component.ts', 'tree/sub/tree-label.component.html', 'tree/sub/tree-label.component.ts', 'tree/sub/tree-node-content.directive.ts', 'tree/tree.component.html', 'tree/tree.component.ts'],
    optionalDependencies: [
      { name: 'context-menu', description: 'Enables right-click context menus on tree nodes' },
    ],
  },
  'speed-dial': {
    name: 'speed-dial',
    files: ['speed-dial/index.ts', 'speed-dial/speed-dial.component.ts', 'speed-dial/sub/speed-dial-context-trigger.component.ts', 'speed-dial/sub/speed-dial-context-trigger.directive.ts', 'speed-dial/sub/speed-dial-item.component.ts', 'speed-dial/sub/speed-dial-mask.component.ts', 'speed-dial/sub/speed-dial-menu.component.ts', 'speed-dial/sub/speed-dial-trigger.component.ts']
  },
  'chip-list': {
    name: 'chip-list',
    files: ['chip-list/chip-list.component.html', 'chip-list/chip-list.component.ts', 'chip-list/index.ts'],
    libFiles: ['input-group.token.ts'],
    dependencies: ['badge', 'button', 'input'],
  },
  'emoji-picker': {
    name: 'emoji-picker',
    files: ['emoji-picker/emoji-data.ts', 'emoji-picker/emoji-picker.component.ts', 'emoji-picker/index.ts', 'emoji-picker/sub/emoji-picker-content.component.ts', 'emoji-picker/sub/emoji-picker-trigger.component.ts'],
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
    files: ['bento-grid/bento-grid.component.css', 'bento-grid/bento-grid.component.html', 'bento-grid/bento-grid.component.ts', 'bento-grid/index.ts', 'bento-grid/sub/bento-grid-item.component.html', 'bento-grid/sub/bento-grid-item.component.ts'],
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
    files: ['split-button/index.ts', 'split-button/split-button.component.ts', 'split-button/sub/split-button-item.component.ts', 'split-button/sub/split-button-menu.component.ts', 'split-button/sub/split-button-primary.component.ts'],
    dependencies: ['button'],
  },
  // Animations
  'gradient-text': {
    name: 'gradient-text',
    files: ['gradient-text/gradient-text.component.html', 'gradient-text/gradient-text.component.ts', 'gradient-text/index.ts'],
  },
  'flip-text': {
    name: 'flip-text',
    files: ['flip-text/flip-text.component.css', 'flip-text/flip-text.component.html', 'flip-text/flip-text.component.ts', 'flip-text/index.ts'],
  },
  meteors: {
    name: 'meteors',
    files: ['meteors/index.ts', 'meteors/meteors.component.ts'],
  },
  'shine-border': {
    name: 'shine-border',
    files: ['shine-border/index.ts', 'shine-border/shine-border.component.html', 'shine-border/shine-border.component.ts'],
  },
  'scroll-progress': {
    name: 'scroll-progress',
    files: ['scroll-progress/index.ts', 'scroll-progress/scroll-progress.component.html', 'scroll-progress/scroll-progress.component.ts'],
  },
  'blur-fade': {
    name: 'blur-fade',
    files: ['blur-fade/blur-fade.component.html', 'blur-fade/blur-fade.component.ts', 'blur-fade/index.ts'],
  },
  ripple: {
    name: 'ripple',
    files: ['ripple.directive.ts'],
  },
  marquee: {
    name: 'marquee',
    files: ['marquee/index.ts', 'marquee/marquee.component.html', 'marquee/marquee.component.ts'],
  },
  'word-rotate': {
    name: 'word-rotate',
    files: ['word-rotate/index.ts', 'word-rotate/word-rotate.component.css', 'word-rotate/word-rotate.component.html', 'word-rotate/word-rotate.component.ts'],
  },
  'morphing-text': {
    name: 'morphing-text',
    files: ['morphing-text/index.ts', 'morphing-text/morphing-text.component.css', 'morphing-text/morphing-text.component.html', 'morphing-text/morphing-text.component.ts'],
  },
  'typing-animation': {
    name: 'typing-animation',
    files: ['typing-animation/index.ts', 'typing-animation/typing-animation.component.css', 'typing-animation/typing-animation.component.html', 'typing-animation/typing-animation.component.ts'],
  },
  'wobble-card': {
    name: 'wobble-card',
    files: ['wobble-card/index.ts', 'wobble-card/wobble-card.component.html', 'wobble-card/wobble-card.component.ts'],
  },
  magnetic: {
    name: 'magnetic',
    files: ['magnetic.directive.ts'],
  },
  orbit: {
    name: 'orbit',
    files: ['orbit/index.ts', 'orbit/orbit.component.html', 'orbit/orbit.component.ts'],
  },
  'stagger-children': {
    name: 'stagger-children',
    files: ['stagger-children/index.ts', 'stagger-children/stagger-children.component.html', 'stagger-children/stagger-children.component.ts'],
  },
  particles: {
    name: 'particles',
    files: ['particles/index.ts', 'particles/particles.component.ts'],
  },
  kanban: {
    name: 'kanban',
    files: ['kanban-locales.ts', 'kanban.component.ts'],
    libFiles: ['shortcut-binding.service.ts', 'touch.ts'],
    dependencies: ['alert-dialog', 'autocomplete', 'avatar', 'badge', 'button', 'chip-list', 'context-menu', 'dialog', 'input', 'label', 'scroll-area', 'separator', 'textarea'],
  },
  'shortcut-bindings-dialog': {
    name: 'shortcut-bindings-dialog',
    files: ['shortcut-bindings-dialog/index.ts', 'shortcut-bindings-dialog/shortcut-bindings-dialog.component.html', 'shortcut-bindings-dialog/shortcut-bindings-dialog.component.ts'],
    libFiles: ['shortcut-binding.service.ts'],
    dependencies: ['accordion', 'badge', 'button', 'dialog', 'scroll-area'],
  },
  tour: {
    name: 'tour',
    files: ['tour/index.ts', 'tour/tour.component.html', 'tour/tour.component.ts'],
    dependencies: ['button'],
  },
  'comparison-slider': {
    name: 'comparison-slider',
    files: ['comparison-slider/comparison-slider.component.html', 'comparison-slider/comparison-slider.component.ts', 'comparison-slider/index.ts'],
    libFiles: ['touch.ts'],
  },
  sortable: {
    name: 'sortable',
    files: ['sortable/index.ts', 'sortable/sortable.component.html', 'sortable/sortable.component.ts', 'sortable/sub/sortable-item.component.html', 'sortable/sub/sortable-item.component.ts'],
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
