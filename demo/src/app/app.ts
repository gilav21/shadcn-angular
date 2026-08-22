import { Component, ChangeDetectionStrategy, signal, inject, computed } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { APP_LOCALE } from './app.config';
import { UI_LOCALE_ID } from '../../../packages/components/lib/i18n';
import { CALENDAR_LOCALES } from '../../../packages/components/lib/i18n/calendar.locales';
import { APP_LOCALES } from './app.locales';
import { CssSettingsComponent } from './css-settings.component';
import { DocsHeaderComponent } from './docs/docs-header.component';
import {
  ButtonComponent,
  SeparatorComponent,
  SelectComponent,
  SelectTriggerComponent,
  SelectValueComponent,
  SelectContentComponent,
  SelectItemComponent,
  CommandComponent,
  CommandInputComponent,
  CommandListComponent,
  CommandEmptyComponent,
  CommandGroupComponent,
  CommandItemComponent,
  CommandDialogComponent,
  COMMAND_DIALOG_SHORTCUT_DEFINITIONS,
  SidebarProviderComponent,
  SidebarComponent,
  SidebarHeaderComponent,
  SidebarContentComponent,
  SidebarFooterComponent,
  SidebarGroupComponent,
  SidebarGroupLabelComponent,
  SidebarGroupContentComponent,
  SidebarMenuComponent,
  SidebarMenuItemComponent,
  SidebarMenuButtonComponent,
  SidebarTriggerComponent,
  SidebarInsetComponent,
  ToasterComponent,
  ShortcutBindingService,
  ShortcutBindingsDialogComponent,
  RICH_TEXT_SHORTCUT_DEFINITIONS,
  IconComponent,
  DropdownMenuComponent,
  DropdownMenuTriggerComponent,
  DropdownMenuContentComponent,
  DropdownMenuItemComponent,
  DropdownMenuLabelComponent,
  DropdownMenuSeparatorComponent,
} from '../../../packages/components/ui';

export type ComponentCategory = 'Inputs' | 'Layout' | 'Navigation' | 'Overlay' | 'Data Display' | 'Feedback' | 'Charts' | 'Animations' | 'Patterns' | 'Blocks';

export interface ComponentNavItem {
  readonly id: string;
  readonly name: string;
  readonly category: ComponentCategory;
  readonly icon: string;
}

@Component({
  selector: 'app-root',
  imports: [
    TitleCasePipe,
    FormsModule,
    RouterOutlet,
    ButtonComponent,
    SeparatorComponent,
    SelectComponent,
    SelectTriggerComponent,
    SelectValueComponent,
    SelectContentComponent,
    SelectItemComponent,
    CommandComponent,
    CommandInputComponent,
    CommandListComponent,
    CommandEmptyComponent,
    CommandGroupComponent,
    CommandItemComponent,
    CommandDialogComponent,
    ShortcutBindingsDialogComponent,
    SidebarProviderComponent,
    SidebarComponent,
    SidebarHeaderComponent,
    SidebarContentComponent,
    SidebarFooterComponent,
    SidebarGroupComponent,
    SidebarGroupLabelComponent,
    SidebarGroupContentComponent,
    SidebarMenuComponent,
    SidebarMenuItemComponent,
    SidebarMenuButtonComponent,
    SidebarTriggerComponent,
    SidebarInsetComponent,
    ToasterComponent,
    IconComponent,
    DropdownMenuComponent,
    DropdownMenuTriggerComponent,
    DropdownMenuContentComponent,
    DropdownMenuItemComponent,
    DropdownMenuLabelComponent,
    DropdownMenuSeparatorComponent,
    CssSettingsComponent,
    DocsHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class AppComponent {
  private readonly shortcutBindings = inject(ShortcutBindingService);
  private readonly router = inject(Router);
  /**
   * App-wide writable locale signal — also injected into `UI_LOCALE_ID`
   * via `provideUiLocale` in `app.config.ts`, so every shadcn-angular
   * component picks it up automatically.
   */
  readonly appLocale = inject(APP_LOCALE);

  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => APP_LOCALES[this.localeId()] ?? APP_LOCALES['en'],
  );

  categoryLabel(category: string): string {
    const map = this.t().categories as Record<string, string>;
    return map[category] ?? category;
  }

  /** Languages offered by the header switcher. The `label` is the language's endonym. */
  readonly localeOptions: ReadonlyArray<{ readonly code: string; readonly label: string }> = [
    { code: 'en', label: 'English' },
    { code: 'he', label: 'עברית' },
    { code: 'ar', label: 'العربية' },
    { code: 'de', label: 'Deutsch' },
    { code: 'fr', label: 'Français' },
    { code: 'es', label: 'Español' },
    { code: 'ja', label: '日本語' },
    { code: 'zh', label: '中文' },
    { code: 'ru', label: 'Русский' },
    { code: 'pt', label: 'Português' },
  ];

  /** Label of the currently-active locale — used for the switcher button's aria-label. */
  readonly currentLocaleLabel = computed(
    () => this.localeOptions.find(o => o.code === this.appLocale())?.label ?? this.appLocale(),
  );

  readonly isDark = signal(false);
  readonly isRtl = signal(false);
  readonly showCommandDialog = signal(false);
  readonly showShortcutBindingsDialog = signal(false);
  readonly sidebarCollapseMode = signal<'icon' | 'hidden'>('icon');

  readonly activeComponent = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects.replace(/^\/+/, '') || 'introduction'),
      startWith(this.router.url.replace(/^\/+/, '') || 'introduction')
    ),
    { initialValue: 'introduction' }
  );

  readonly componentLinks: readonly ComponentNavItem[] = [
    { id: 'recipes', name: 'Recipes', category: 'Patterns', icon: '📋' },
    { id: 'theme-playground', name: 'Theme Playground', category: 'Patterns', icon: '🎨' },
    // Inputs
    { id: 'autocomplete', name: 'Autocomplete', category: 'Inputs', icon: '🔍' },
    { id: 'buttons', name: 'Buttons', category: 'Inputs', icon: '🔘' },
    { id: 'button-group', name: 'Button Group', category: 'Inputs', icon: '🔲' },
    { id: 'calendar', name: 'Calendar', category: 'Inputs', icon: '📆' },
    { id: 'checkbox', name: 'Checkbox', category: 'Inputs', icon: '☑️' },
    { id: 'chip-list', name: 'Chip List', category: 'Inputs', icon: '🏷️' },
    { id: 'color-picker', name: 'Color Picker', category: 'Inputs', icon: '🎨' },
    { id: 'eyedropper', name: 'Eyedropper', category: 'Inputs', icon: '💧' },
    { id: 'image-extract', name: 'Image Color Extract', category: 'Inputs', icon: '🖼️' },
    { id: 'date-picker', name: 'Date Picker', category: 'Inputs', icon: '📅' },
    { id: 'emoji-picker', name: 'Emoji Picker', category: 'Inputs', icon: '😀' },
    { id: 'field', name: 'Field', category: 'Inputs', icon: '📝' },
    { id: 'file-upload', name: 'File Upload', category: 'Inputs', icon: '📤' },
    { id: 'form', name: 'Form', category: 'Inputs', icon: '📋' },
    { id: 'input', name: 'Input', category: 'Inputs', icon: '✏️' },
    { id: 'input-group', name: 'Input Group', category: 'Inputs', icon: '📥' },
    { id: 'input-mask', name: 'Input Mask', category: 'Inputs', icon: '🎭' },
    { id: 'input-otp', name: 'Input OTP', category: 'Inputs', icon: '🔐' },
    { id: 'label', name: 'Label', category: 'Inputs', icon: '🏷️' },
    { id: 'native-select', name: 'Native Select', category: 'Inputs', icon: '📋' },
    { id: 'number-input', name: 'Number Input', category: 'Inputs', icon: '🔢' },
    { id: 'phone-input', name: 'Phone Input', category: 'Inputs', icon: '📞' },
    { id: 'radio-group', name: 'Radio Group', category: 'Inputs', icon: '🔘' },
    { id: 'rating', name: 'Rating', category: 'Inputs', icon: '⭐' },
    { id: 'rich-text-editor', name: 'Rich Text Editor', category: 'Inputs', icon: '📝' },
    { id: 'rich-text-editor-addons', name: 'Rich Text Editor Addons', category: 'Inputs', icon: '🧩' },
    { id: 'rich-text-actions', name: 'Rich Text Actions', category: 'Inputs', icon: '⚡' },
    { id: 'select', name: 'Select', category: 'Inputs', icon: '📋' },
    { id: 'slider', name: 'Slider', category: 'Inputs', icon: '🎚️' },
    { id: 'sortable', name: 'Sortable', category: 'Inputs', icon: '↕️' },
    { id: 'split-button', name: 'Split Button', category: 'Inputs', icon: '🔽' },
    { id: 'switch', name: 'Switch', category: 'Inputs', icon: '⚡' },
    { id: 'textarea', name: 'Textarea', category: 'Inputs', icon: '📄' },
    { id: 'toggle', name: 'Toggle', category: 'Inputs', icon: '🔀' },
    { id: 'toggle-group', name: 'Toggle Group', category: 'Inputs', icon: '🎛️' },
    { id: 'tree-select', name: 'Tree Select', category: 'Inputs', icon: '🌲' },

    // Layout
    { id: 'aspect-ratio', name: 'Aspect Ratio', category: 'Layout', icon: '📐' },
    { id: 'page-header', name: 'Page Header', category: 'Layout', icon: '🏷️' },
    { id: 'masonry', name: 'Masonry', category: 'Layout', icon: '🧱' },
    { id: 'bento-grid', name: 'Bento Grid', category: 'Layout', icon: '🍱' },
    { id: 'collapsible', name: 'Collapsible', category: 'Layout', icon: '📂' },
    { id: 'comparison-slider', name: 'Comparison Slider', category: 'Layout', icon: '↔️' },
    { id: 'resizable', name: 'Resizable', category: 'Layout', icon: '↔️' },
    { id: 'scroll-area', name: 'Scroll Area', category: 'Layout', icon: '📜' },
    { id: 'sidebar', name: 'Sidebar', category: 'Layout', icon: '📎' },
    { id: 'infinite-canvas', name: 'Infinite Canvas', category: 'Layout', icon: '🗺️' },
    { id: 'node-editor', name: 'Node Editor', category: 'Layout', icon: '🕸️' },
    { id: 'virtual-scroll', name: 'Virtual Scroll', category: 'Layout', icon: '📜' },

    // Navigation
    { id: 'breadcrumb', name: 'Breadcrumb', category: 'Navigation', icon: '🍞' },
    { id: 'menubar', name: 'Menubar', category: 'Navigation', icon: '☰' },
    { id: 'navigation-menu', name: 'Navigation Menu', category: 'Navigation', icon: '🧭' },
    { id: 'pagination', name: 'Pagination', category: 'Navigation', icon: '📄' },
    { id: 'stepper', name: 'Stepper', category: 'Navigation', icon: '👣' },
    { id: 'tabs', name: 'Tabs', category: 'Navigation', icon: '📑' },

    // Overlay
    { id: 'alert-dialog', name: 'Alert Dialog', category: 'Overlay', icon: '🚨' },
    { id: 'command', name: 'Command', category: 'Overlay', icon: '⌘' },
    { id: 'context-menu', name: 'Context Menu', category: 'Overlay', icon: '📋' },
    { id: 'dialog', name: 'Dialog', category: 'Overlay', icon: '💭' },
    { id: 'editor-in-dialog', name: 'Editor in Dialog', category: 'Overlay', icon: '🪟' },
    { id: 'drawer', name: 'Drawer', category: 'Overlay', icon: '🗄️' },
    { id: 'dropdown-menu', name: 'Dropdown Menu', category: 'Overlay', icon: '📜' },
    { id: 'hover-card', name: 'Hover Card', category: 'Overlay', icon: '🖱️' },
    { id: 'popover', name: 'Popover', category: 'Overlay', icon: '🗨️' },
    { id: 'sheet', name: 'Sheet', category: 'Overlay', icon: '📃' },
    { id: 'speed-dial', name: 'Speed Dial', category: 'Overlay', icon: '📞' },
    { id: 'shortcut-bindings-dialog', name: 'Shortcut Bindings Dialog', category: 'Overlay', icon: '⌨️' },
    { id: 'tooltip', name: 'Tooltip', category: 'Overlay', icon: '💡' },

    // Data Display
    { id: 'accordion', name: 'Accordion', category: 'Data Display', icon: '🪗' },
    { id: 'card-accordion', name: 'Card Accordion', category: 'Data Display', icon: '🗂️' },
    { id: 'avatar', name: 'Avatar', category: 'Data Display', icon: '👤' },
    { id: 'badge', name: 'Badge', category: 'Data Display', icon: '🔖' },
    { id: 'card', name: 'Card', category: 'Data Display', icon: '🃏' },
    { id: 'carousel', name: 'Carousel', category: 'Data Display', icon: '🎠' },
    { id: 'code-block', name: 'Code Block', category: 'Data Display', icon: '💻' },
    { id: 'data-table', name: 'Data Table', category: 'Data Display', icon: '📊' },
    { id: 'empty', name: 'Empty', category: 'Data Display', icon: '📭' },
    { id: 'file-viewer', name: 'File Viewer', category: 'Data Display', icon: '👁' },
    { id: 'icon', name: 'Icon', category: 'Data Display', icon: '🎯' },
    { id: 'kbd', name: 'Kbd', category: 'Data Display', icon: '⌨️' },
    { id: 'number-ticker', name: 'Number Ticker', category: 'Data Display', icon: '🔢' },
    { id: 'separator', name: 'Separator', category: 'Data Display', icon: '➖' },
    { id: 'table', name: 'Table', category: 'Data Display', icon: '📊' },
    { id: 'stat-card', name: 'Stat Card', category: 'Data Display', icon: '📈' },
    { id: 'data-list', name: 'Data List', category: 'Data Display', icon: '📋' },
    { id: 'timeline', name: 'Timeline', category: 'Data Display', icon: '📅' },
    { id: 'tree-view', name: 'Tree View', category: 'Data Display', icon: '🌳' },
    { id: 'component-outlet', name: 'Component Outlet', category: 'Data Display', icon: '🧩' },
    { id: 'copy-to', name: 'Copy To', category: 'Data Display', icon: '📋' },
    { id: 'context-menu-attach', name: 'Context Menu Attach', category: 'Data Display', icon: '🖱️' },
    { id: 'tree-context-menu', name: 'Tree Context Menu', category: 'Data Display', icon: '🌲' },
    { id: 'table-context-menu', name: 'Table Context Menu', category: 'Data Display', icon: '📑' },
    { id: 'data-table-context-menu', name: 'Data Table Context Menu', category: 'Data Display', icon: '🗂️' },

    // Feedback
    { id: 'alert', name: 'Alert', category: 'Feedback', icon: '⚠️' },
    { id: 'banner', name: 'Banner', category: 'Feedback', icon: '📣' },
    { id: 'error-page', name: 'Error Page', category: 'Feedback', icon: '🚧' },
    { id: 'result', name: 'Result', category: 'Feedback', icon: '🏁' },
    { id: 'progress', name: 'Progress', category: 'Feedback', icon: '📈' },
    { id: 'skeleton', name: 'Skeleton', category: 'Feedback', icon: '💀' },
    { id: 'spinner', name: 'Spinner', category: 'Feedback', icon: '🔄' },
    { id: 'toast', name: 'Toast', category: 'Feedback', icon: '🍞' },

    // Charts
    { id: 'charts', name: 'Charts', category: 'Charts', icon: '📊' },

    // Animations
    { id: 'animations', name: 'Animations', category: 'Animations', icon: '🎬' },
    { id: 'confetti', name: 'Confetti', category: 'Animations', icon: '🎉' },

    // Patterns
    { id: 'chat', name: 'Chat', category: 'Patterns', icon: '💬' },
    { id: 'dock', name: 'Dock', category: 'Patterns', icon: '⚓' },
    { id: 'kanban', name: 'Kanban Board', category: 'Patterns', icon: '📋' },
    { id: 'page-builder', name: 'Page Builder', category: 'Patterns', icon: '🏗️' },
    { id: 'page-renderer', name: 'Page Renderer', category: 'Patterns', icon: '📄' },
    { id: 'tour', name: 'Tour', category: 'Patterns', icon: '🧭' },

    // Blocks
    { id: 'login', name: 'Login', category: 'Blocks', icon: '🔑' },
    { id: 'signup', name: 'Signup', category: 'Blocks', icon: '📝' },
    { id: 'forgot-password', name: 'Forgot Password', category: 'Blocks', icon: '🔁' },
    { id: 'dashboard', name: 'Dashboard', category: 'Blocks', icon: '📊' },
    { id: 'settings-profile', name: 'Settings — Profile', category: 'Blocks', icon: '⚙️' },
    { id: 'settings-account', name: 'Settings — Account', category: 'Blocks', icon: '🔐' },
    { id: 'hero', name: 'Hero', category: 'Blocks', icon: '🚀' },
    { id: 'features', name: 'Features', category: 'Blocks', icon: '✨' },
    { id: 'faq', name: 'FAQ', category: 'Blocks', icon: '❓' },
    { id: 'pricing', name: 'Pricing', category: 'Blocks', icon: '💳' },
  ];

  readonly categories = computed(() => {
    const cats = new Set(this.componentLinks.map(l => l.category));
    return Array.from(cats).sort((a, b) => a.localeCompare(b));
  });

  readonly linksByCategory = computed(() => {
    const map = new Map<string, ComponentNavItem[]>();
    for (const category of this.categories()) {
      map.set(
        category,
        this.componentLinks
          .filter(l => l.category === category)
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    }
    return map;
  });

  constructor() {
    this.shortcutBindings.defineShortcuts('command-dialog', COMMAND_DIALOG_SHORTCUT_DEFINITIONS);
    this.shortcutBindings.defineShortcuts('rich-text-editor', RICH_TEXT_SHORTCUT_DEFINITIONS);

    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    ).subscribe(e => {
      const path = e.urlAfterRedirects.replace(/^\/+/, '');
      const link = this.componentLinks.find(l => l.id === path);
      document.title = link ? `${link.name} - shadcn-angular` : 'shadcn-angular';
    });
  }

  onKeydown(e: KeyboardEvent): void {
    this.shortcutBindings.dispatch(e);
  }

  toggleTheme(checked: boolean): void {
    this.isDark.set(checked);
    if (checked) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  toggleDirection(checked: boolean): void {
    this.isRtl.set(checked);
    document.documentElement.dir = checked ? 'rtl' : 'ltr';
  }

  /**
   * Set the app-wide locale (broadcasts to every shadcn-angular component
   * via `UI_LOCALE_ID`) and auto-flip `dir` to `rtl` when the chosen
   * locale is RTL, so Tailwind's `rtl:*` modifiers track the language.
   */
  setAppLocale(code: string): void {
    this.appLocale.set(code);
    const rtl = CALENDAR_LOCALES[code]?.rtl === true;
    this.toggleDirection(rtl);
  }

  navTo(id: string): void {
    this.showCommandDialog.set(false);
    this.router.navigate([id === 'introduction' ? '/' : `/${id}`]);
  }

  getLinksByCategory(category: string): ComponentNavItem[] {
    return this.linksByCategory().get(category) ?? [];
  }
}
