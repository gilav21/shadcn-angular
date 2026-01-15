// Component Registry - Defines available components and their file mappings
// Actual component files are stored in packages/components/ui/

export interface ComponentDefinition {
  name: string;
  files: string[]; // Relative paths to component files
  dependencies?: string[]; // Other components this depends on
}

export type ComponentName = keyof typeof registry;

// Registry maps component names to their file definitions
// Files are relative to the components/ui directory
export const registry: Record<string, ComponentDefinition> = {
  accordion: {
    name: 'accordion',
    files: ['accordion.component.ts'],
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
  },
  'button-group': {
    name: 'button-group',
    files: ['button-group.component.ts'],
    dependencies: ['button']
  },
  calendar: {
    name: 'calendar',
    files: ['calendar.component.ts', 'calendar-locales.ts'],
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
  command: {
    name: 'command',
    files: ['command.component.ts'],
    dependencies: ['dialog'],
  },
  'context-menu': {
    name: 'context-menu',
    files: ['context-menu.component.ts'],
  },
  'date-picker': {
    name: 'date-picker',
    files: ['date-picker.component.ts'],
    dependencies: ['calendar'],
  },
  dialog: {
    name: 'dialog',
    files: ['dialog.component.ts'],
  },
  drawer: {
    name: 'drawer',
    files: ['drawer.component.ts'],
  },
  'dropdown-menu': {
    name: 'dropdown-menu',
    files: ['dropdown-menu.component.ts'],
  },
  empty: {
    name: 'empty',
    files: ['empty.component.ts'],
  },
  field: {
    name: 'field',
    files: ['field.component.ts'],
  },
  'hover-card': {
    name: 'hover-card',
    files: ['hover-card.component.ts'],
  },
  input: {
    name: 'input',
    files: ['input.component.ts'],
  },
  'input-group': {
    name: 'input-group',
    files: ['input-group.component.ts'],
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
  },
  'native-select': {
    name: 'native-select',
    files: ['native-select.component.ts'],
  },
  'navigation-menu': {
    name: 'navigation-menu',
    files: ['navigation-menu.component.ts'],
  },
  pagination: {
    name: 'pagination',
    files: ['pagination.component.ts'],
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
  resizable: {
    name: 'resizable',
    files: ['resizable.component.ts'],
  },
  'scroll-area': {
    name: 'scroll-area',
    files: ['scroll-area.component.ts'],
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
    files: ['textarea.component.ts'],
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
  },
  'speed-dial': {
    name: 'speed-dial',
    files: ['speed-dial.component.ts'],
    dependencies: ['button']
  },
  'chip-list': {
    name: 'chip-list',
    files: ['chip-list.component.ts'],
    dependencies: ['badge', 'button'],
  },
  'emoji-picker': {
    name: 'emoji-picker',
    files: ['emoji-picker.component.ts', 'emoji-data.ts'],
    dependencies: ['button', 'input', 'scroll-area', 'popover'],
  },
  'rich-text-editor': {
    name: 'rich-text-editor',
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
  },
};
