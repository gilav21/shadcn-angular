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
    libFiles: ['i18n/calendar.locales.ts', 'i18n/common.locales.ts', 'i18n/i18n.token.ts', 'i18n/i18n.types.ts', 'i18n/i18n.utils.ts', 'i18n/index.ts'],
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
    libFiles: ['i18n/calendar.locales.ts', 'i18n/common.locales.ts', 'i18n/i18n.token.ts', 'i18n/i18n.types.ts', 'i18n/i18n.utils.ts', 'i18n/index.ts'],
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
    files: ['color-picker/color-picker.component.css', 'color-picker/color-picker.component.html', 'color-picker/color-picker.component.ts', 'color-picker/color-picker.utils.ts', 'color-picker/index.ts'],
    dependencies: ['eyedropper', 'icon', 'input', 'popover', 'tabs', 'tooltip'],
    libFiles: ['color-extract.ts', 'color.ts', 'touch.ts'],
  },
  confetti: {
    name: 'confetti',
    files: ['confetti.directive.ts'],
  },
  command: {
    name: 'command',
    files: ['command/command.component.ts', 'command/index.ts', 'command/sub/command-dialog.component.ts', 'command/sub/command-empty.component.ts', 'command/sub/command-group.component.ts', 'command/sub/command-input.component.ts', 'command/sub/command-item.component.ts', 'command/sub/command-list.component.ts', 'command/sub/command-separator.component.ts', 'command/sub/command-shortcut.component.ts'],
    dependencies: ['dialog'],
    libFiles: ['shortcut-binding.service.ts'],
    shortcutDefinitions: [
      {
        exportName: 'COMMAND_DIALOG_SHORTCUT_DEFINITIONS',
        componentName: 'command-dialog',
        sourceFile: 'command/command.component.ts',
      },
    ],
  },
  'context-menu': {
    name: 'context-menu',
    files: ['context-menu/context-menu.component.ts', 'context-menu/index.ts', 'context-menu/sub/context-menu-content.component.ts', 'context-menu/sub/context-menu-item.component.ts', 'context-menu/sub/context-menu-label.component.ts', 'context-menu/sub/context-menu-separator.component.ts', 'context-menu/sub/context-menu-shortcut.component.ts', 'context-menu/sub/context-menu-sub-content.component.ts', 'context-menu/sub/context-menu-sub-trigger.component.ts', 'context-menu/sub/context-menu-sub.component.ts', 'context-menu/sub/context-menu-trigger.component.ts', 'context-menu/sub/context-menu-trigger.directive.ts'],
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
      'context-menu-attach.directive.ts',
      'tree-context-menu.directive.ts',
      'table-context-menu.directive.ts',
      'data-table-context-menu.directive.ts',
    ],
    dependencies: ['badge', 'button', 'calendar', 'checkbox', 'command', 'component-outlet', 'context-menu', 'icon', 'input', 'pagination', 'popover', 'select', 'table'],
    libFiles: ['i18n/calendar.locales.ts', 'i18n/common.locales.ts', 'i18n/i18n.token.ts', 'i18n/i18n.types.ts', 'i18n/i18n.utils.ts', 'i18n/index.ts', 'parsers/xlsx.ts', 'touch.ts'],
    optionalDependencies: [
      { name: 'context-menu', description: 'Enables right-click context menus on rows and headers' },
    ],
  },
  dialog: {
    name: 'dialog',
    files: ['dialog/dialog.component.ts', 'dialog/index.ts', 'dialog/sub/dialog-content.component.html', 'dialog/sub/dialog-content.component.ts', 'dialog/sub/dialog-description.component.ts', 'dialog/sub/dialog-footer.component.ts', 'dialog/sub/dialog-header.component.ts', 'dialog/sub/dialog-title.component.ts', 'dialog/sub/dialog-trigger.component.ts'],
    libFiles: ['i18n/calendar.locales.ts', 'i18n/common.locales.ts', 'i18n/i18n.token.ts', 'i18n/i18n.types.ts', 'i18n/i18n.utils.ts', 'i18n/index.ts'],
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
    files: ['dropdown-menu/dropdown-menu.component.ts', 'dropdown-menu/index.ts', 'dropdown-menu/sub/dropdown-menu-content.component.ts', 'dropdown-menu/sub/dropdown-menu-item.component.ts', 'dropdown-menu/sub/dropdown-menu-label.component.ts', 'dropdown-menu/sub/dropdown-menu-separator.component.ts', 'dropdown-menu/sub/dropdown-menu-sub-content.component.ts', 'dropdown-menu/sub/dropdown-menu-sub-trigger.component.ts', 'dropdown-menu/sub/dropdown-menu-sub.component.ts', 'dropdown-menu/sub/dropdown-menu-trigger.component.ts'],
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
    files: ['menubar/index.ts', 'menubar/menubar.component.ts', 'menubar/sub/menubar-content.component.ts', 'menubar/sub/menubar-item.component.ts', 'menubar/sub/menubar-menu.component.ts', 'menubar/sub/menubar-separator.component.ts', 'menubar/sub/menubar-shortcut.component.ts', 'menubar/sub/menubar-sub-content.component.ts', 'menubar/sub/menubar-sub-trigger.component.ts', 'menubar/sub/menubar-sub.component.ts', 'menubar/sub/menubar-trigger.component.ts'],
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
    files: ['pagination/index.ts', 'pagination/pagination.component.ts', 'pagination/pagination.locales.ts', 'pagination/sub/pagination-content.component.ts', 'pagination/sub/pagination-ellipsis.component.ts', 'pagination/sub/pagination-item.component.ts', 'pagination/sub/pagination-link.component.ts', 'pagination/sub/pagination-next.component.ts', 'pagination/sub/pagination-previous.component.ts'],
    libFiles: ['i18n/calendar.locales.ts', 'i18n/common.locales.ts', 'i18n/i18n.token.ts', 'i18n/i18n.types.ts', 'i18n/i18n.utils.ts', 'i18n/index.ts'],
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
    files: ['select/index.ts', 'select/select.component.ts', 'select/sub/select-content.component.ts', 'select/sub/select-group.component.ts', 'select/sub/select-item.component.ts', 'select/sub/select-label.component.ts', 'select/sub/select-separator.component.ts', 'select/sub/select-trigger.component.ts', 'select/sub/select-value.component.ts'],
  },
  separator: {
    name: 'separator',
    files: ['separator/index.ts', 'separator/separator.component.ts'],
  },
  sheet: {
    name: 'sheet',
    files: ['sheet/index.ts', 'sheet/sheet.component.ts', 'sheet/sub/sheet-close.component.ts', 'sheet/sub/sheet-content.component.ts', 'sheet/sub/sheet-description.component.ts', 'sheet/sub/sheet-footer.component.ts', 'sheet/sub/sheet-header.component.ts', 'sheet/sub/sheet-title.component.ts', 'sheet/sub/sheet-trigger.component.ts'],
    libFiles: ['i18n/calendar.locales.ts', 'i18n/common.locales.ts', 'i18n/i18n.token.ts', 'i18n/i18n.types.ts', 'i18n/i18n.utils.ts', 'i18n/index.ts'],
  },
  sidebar: {
    name: 'sidebar',
    files: ['sidebar/index.ts', 'sidebar/sidebar.component.ts', 'sidebar/sidebar.service.ts', 'sidebar/sub/sidebar-content.component.ts', 'sidebar/sub/sidebar-footer.component.ts', 'sidebar/sub/sidebar-group-content.component.ts', 'sidebar/sub/sidebar-group-label.component.ts', 'sidebar/sub/sidebar-group.component.ts', 'sidebar/sub/sidebar-header.component.ts', 'sidebar/sub/sidebar-inset.component.ts', 'sidebar/sub/sidebar-menu-button.component.ts', 'sidebar/sub/sidebar-menu-item.component.ts', 'sidebar/sub/sidebar-menu-link.component.ts', 'sidebar/sub/sidebar-menu.component.ts', 'sidebar/sub/sidebar-provider.component.ts', 'sidebar/sub/sidebar-separator.component.ts', 'sidebar/sub/sidebar-trigger.component.ts'],
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
    files: ['table/index.ts', 'table/sub/table-body.component.ts', 'table/sub/table-caption.component.ts', 'table/sub/table-cell.component.ts', 'table/sub/table-footer.component.ts', 'table/sub/table-head.component.ts', 'table/sub/table-header-directive.ts', 'table/sub/table-header.component.ts', 'table/sub/table-row.component.ts', 'table/table.component.ts'],
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
    libFiles: ['i18n/calendar.locales.ts', 'i18n/common.locales.ts', 'i18n/i18n.token.ts', 'i18n/i18n.types.ts', 'i18n/i18n.utils.ts', 'i18n/index.ts'],
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
    files: ['rich-text-editor/index.ts', 'rich-text-editor/rich-text-command-registry.service.ts', 'rich-text-editor/rich-text-editor.component.html', 'rich-text-editor/rich-text-editor.component.ts', 'rich-text-editor/rich-text-locales.ts', 'rich-text-editor/rich-text-markdown.service.ts', 'rich-text-editor/rich-text-paste-normalizer.service.ts', 'rich-text-editor/rich-text-sanitizer.service.ts', 'rich-text-editor/sub/rich-text-image-resizer.component.html', 'rich-text-editor/sub/rich-text-image-resizer.component.ts', 'rich-text-editor/sub/rich-text-mention.component.html', 'rich-text-editor/sub/rich-text-mention.component.ts', 'rich-text-editor/sub/rich-text-toolbar.component.css', 'rich-text-editor/sub/rich-text-toolbar.component.html', 'rich-text-editor/sub/rich-text-toolbar.component.ts'],
    dependencies: ['autocomplete', 'button', 'dialog', 'emoji-picker', 'popover', 'scroll-area', 'separator'],
    libFiles: ['i18n/calendar.locales.ts', 'i18n/common.locales.ts', 'i18n/i18n.token.ts', 'i18n/i18n.types.ts', 'i18n/i18n.utils.ts', 'i18n/index.ts', 'parsers/docx-parser.ts', 'parsers/docx-to-editor-html.ts', 'parsers/image-validator.ts', 'parsers/inflate.ts', 'parsers/pdf-parser.ts', 'parsers/svg-sanitizer.ts', 'parsers/zip-reader.ts', 'shortcut-binding.service.ts', 'touch.ts'],
    shortcutDefinitions: [
      {
        exportName: 'RICH_TEXT_SHORTCUT_DEFINITIONS',
        componentName: 'rich-text-editor',
        sourceFile: 'rich-text-editor/rich-text-editor.component.ts',
      },
    ],
  },
  // Chart Components
  'pie-chart': {
    name: 'pie-chart',
    files: ['pie-chart/index.ts', 'pie-chart/pie-chart.component.html', 'pie-chart/pie-chart.component.ts'],
    libFiles: ['chart.types.ts', 'chart.utils.ts'],
  },
  'pie-chart-drilldown': {
    name: 'pie-chart-drilldown',
    files: ['pie-chart-drilldown/index.ts', 'pie-chart-drilldown/pie-chart-drilldown.component.html', 'pie-chart-drilldown/pie-chart-drilldown.component.ts'],
    libFiles: ['chart.types.ts', 'chart.utils.ts'],
  },
  'bar-chart': {
    name: 'bar-chart',
    files: ['bar-chart/bar-chart.component.html', 'bar-chart/bar-chart.component.ts', 'bar-chart/index.ts'],
    libFiles: ['chart.types.ts', 'chart.utils.ts'],
  },
  'bar-chart-drilldown': {
    name: 'bar-chart-drilldown',
    files: ['bar-chart-drilldown/bar-chart-drilldown.component.html', 'bar-chart-drilldown/bar-chart-drilldown.component.ts', 'bar-chart-drilldown/index.ts'],
    libFiles: ['chart.types.ts', 'chart.utils.ts'],
  },
  'stacked-bar-chart': {
    name: 'stacked-bar-chart',
    files: ['stacked-bar-chart/index.ts', 'stacked-bar-chart/stacked-bar-chart.component.html', 'stacked-bar-chart/stacked-bar-chart.component.ts'],
    libFiles: ['chart.types.ts', 'chart.utils.ts'],
  },
  'column-range-chart': {
    name: 'column-range-chart',
    files: ['column-range-chart/column-range-chart.component.html', 'column-range-chart/column-range-chart.component.ts', 'column-range-chart/index.ts'],
    libFiles: ['chart.types.ts', 'chart.utils.ts'],
  },
  'bar-race-chart': {
    name: 'bar-race-chart',
    files: ['bar-race-chart/bar-race-chart.component.html', 'bar-race-chart/bar-race-chart.component.ts', 'bar-race-chart/index.ts'],
    libFiles: ['chart.types.ts', 'chart.utils.ts'],
  },
  'org-chart': {
    name: 'org-chart',
    files: ['org-chart/index.ts', 'org-chart/org-chart.component.html', 'org-chart/org-chart.component.ts'],
    libFiles: ['chart.types.ts', 'chart.utils.ts'],
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
    files: ['page-builder/index.ts', 'page-builder/page-builder.component.html', 'page-builder/page-builder.component.ts', 'page-builder/sub/property-editor.component.html', 'page-builder/sub/property-editor.component.ts'],
    libFiles: ['page-builder.types.ts'],
  },
  'page-renderer': {
    name: 'page-renderer',
    dependencies: ['bento-grid'],
    files: ['page-renderer/index.ts', 'page-renderer/page-renderer.component.html', 'page-renderer/page-renderer.component.ts'],
    libFiles: ['page-builder.types.ts'],
  },
  'component-outlet': {
    name: 'component-outlet',
    files: ['component-outlet.directive.ts'],
    dependencies: ['data-table'],
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
    files: ['kanban/index.ts', 'kanban/kanban-locales.ts', 'kanban/kanban.component.ts', 'kanban/sub/kanban-card-content.component.ts', 'kanban/sub/kanban-card-dialog.component.ts', 'kanban/sub/kanban-card.component.ts', 'kanban/sub/kanban-column-dialog.component.ts', 'kanban/sub/kanban-column-header.component.ts', 'kanban/sub/kanban-column.component.ts', 'kanban/sub/kanban-delete-column-dialog.component.ts'],
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
    files: ['sortable/index.ts', 'sortable/sortable-locales.ts', 'sortable/sortable.component.html', 'sortable/sortable.component.ts', 'sortable/sortable.types.ts', 'sortable/sub/sortable-ghost.directive.ts', 'sortable/sub/sortable-item.component.html', 'sortable/sub/sortable-item.component.ts', 'sortable/sub/sortable-placeholder.directive.ts'],
    libFiles: ['auto-scroll.ts', 'flip.ts', 'i18n/calendar.locales.ts', 'i18n/common.locales.ts', 'i18n/i18n.token.ts', 'i18n/i18n.types.ts', 'i18n/i18n.utils.ts', 'i18n/index.ts', 'sortable-aria-live.ts', 'sortable-registry.ts', 'touch.ts'],
  },
  'context-menu-attach': {
    name: 'context-menu-attach',
    files: ['context-menu-attach.directive.ts'],
    dependencies: ['context-menu'],
  },
  'tree-context-menu': {
    name: 'tree-context-menu',
    files: ['tree-context-menu.directive.ts'],
    dependencies: ['context-menu'],
  },
  'table-context-menu': {
    name: 'table-context-menu',
    files: ['table-context-menu.directive.ts'],
    dependencies: ['context-menu'],
  },
  'data-table-context-menu': {
    name: 'data-table-context-menu',
    files: ['data-table-context-menu.directive.ts'],
    dependencies: ['context-menu', 'data-table', 'table-context-menu'],
  },
  eyedropper: {
    name: 'eyedropper',
    files: ['eyedropper/eyedropper.component.html', 'eyedropper/eyedropper.component.ts', 'eyedropper/index.ts'],
    libFiles: ['color.ts', 'touch.ts'],
    dependencies: ['icon'],
  },
});

export type ComponentName = keyof typeof registry;

export function isComponentName(name: string): name is ComponentName {
    return name in registry;
}

export function getComponentNames(): ComponentName[] {
    return Object.keys(registry) as ComponentName[];
}

// ---------------------------------------------------------------------------
// Registry introspection helpers
//
// Used by the `why` CLI command, the e2e test impact analyzer, and the
// `e2e:scaffold` generator. Pure functions over the registry — no I/O,
// no caching beyond a memoized reverse-dep map.
// ---------------------------------------------------------------------------

/**
 * Maps a repo-rooted file path (e.g.
 * `packages/components/ui/button/button.component.ts` or
 * `packages/components/lib/chart.types.ts`) to the component that owns it
 * by scanning `files[]` / `libFiles[]` / `peerFiles[]`.
 *
 * Returns the first matching component name. For `libFiles` shared across
 * many components, prefer `getComponentsUsingLibFile` to enumerate them
 * all. Returns `null` for paths that aren't in the registry (docs, demo,
 * scripts, etc.) — callers should treat that as "no impact".
 */
export function getComponentForFile(filePath: string): ComponentName | null {
    const uiMatch = /^packages\/components\/ui\/(.+)$/.exec(filePath);
    if (uiMatch) {
        const tail = uiMatch[1];
        for (const name of Object.keys(registry) as ComponentName[]) {
            if (registry[name].files.includes(tail)) return name;
            if (registry[name].peerFiles?.includes(tail)) return name;
        }
    }
    const libMatch = /^packages\/components\/lib\/(.+)$/.exec(filePath);
    if (libMatch) {
        const tail = libMatch[1];
        for (const name of Object.keys(registry) as ComponentName[]) {
            if (registry[name].libFiles?.includes(tail)) return name;
        }
    }
    return null;
}

/**
 * Every component that lists `libFile` (e.g. `chart.types.ts`,
 * `calendar-locales.ts`) in its `libFiles[]`. Used by the impact analyzer
 * to schedule all chart components when a shared chart utility changes,
 * instead of treating the whole `packages/components/lib/` folder as a
 * coarse tripwire.
 */
export function getComponentsUsingLibFile(libFile: string): ComponentName[] {
    const out: ComponentName[] = [];
    for (const name of Object.keys(registry) as ComponentName[]) {
        if (registry[name].libFiles?.includes(libFile)) out.push(name);
    }
    return out;
}

/**
 * Closure of the reverse-dependency graph: every component that
 * transitively lists `name` in its `dependencies[]`. Returns a set so
 * callers can merge results from multiple seeds without deduping. The
 * seed `name` itself is NOT included.
 *
 * Example: `getReverseDependents('command')` → `{ autocomplete }` because
 * autocomplete.dependencies includes 'command'. Walks transitively, so a
 * primitive like `ripple` returns every component that uses it directly
 * or via a chain.
 */
export function getReverseDependents(name: ComponentName): Set<ComponentName> {
    const graph = reverseDepGraph();
    const out = new Set<ComponentName>();
    const queue: ComponentName[] = [name];
    while (queue.length > 0) {
        const current = queue.shift()!;
        for (const dependent of graph.get(current) ?? []) {
            if (!out.has(dependent)) {
                out.add(dependent);
                queue.push(dependent);
            }
        }
    }
    return out;
}

let _reverseDepGraph: Map<ComponentName, ComponentName[]> | null = null;
function reverseDepGraph(): Map<ComponentName, ComponentName[]> {
    if (_reverseDepGraph) return _reverseDepGraph;
    const graph = new Map<ComponentName, ComponentName[]>();
    for (const name of Object.keys(registry) as ComponentName[]) {
        for (const dep of registry[name].dependencies ?? []) {
            if (!isComponentName(dep)) continue;
            const list = graph.get(dep) ?? [];
            list.push(name);
            graph.set(dep, list);
        }
    }
    _reverseDepGraph = graph;
    return graph;
}

/**
 * Levenshtein edit distance — used by `why <component>` and
 * `e2e:scaffold <name>` to suggest the closest registry key when the
 * caller mistypes a name. Plain DP; tiny inputs (component names are <
 * 30 chars), so the O(n·m) cost is negligible.
 */
export function levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const m = a.length, n = b.length;
    let prev = new Array<number>(n + 1);
    let curr = new Array<number>(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;

    for (let i = 1; i <= m; i++) {
        curr[0] = i;
        for (let j = 1; j <= n; j++) {
            const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
            curr[j] = Math.min(
                curr[j - 1] + 1,           // insertion
                prev[j] + 1,               // deletion
                prev[j - 1] + cost,        // substitution
            );
        }
        [prev, curr] = [curr, prev];
    }
    return prev[n];
}

/**
 * Nearest registered component name to `query` by Levenshtein distance.
 * Returns `null` when the closest match is too far away to be useful
 * (more than `Math.max(2, Math.floor(query.length / 2))` edits) — so
 * `radoi-group` suggests `radio-group`, but `xyzqwert` suggests nothing.
 */
export function suggestComponentName(query: string): ComponentName | null {
    const names = getComponentNames();
    let bestName: ComponentName | null = null;
    let bestDist = Infinity;
    for (const name of names) {
        const d = levenshtein(query, name);
        if (d < bestDist) {
            bestDist = d;
            bestName = name;
        }
    }
    const limit = Math.max(2, Math.floor(query.length / 2));
    return bestName !== null && bestDist <= limit ? bestName : null;
}
