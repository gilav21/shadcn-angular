import { Component, ChangeDetectionStrategy, signal, inject, computed, DestroyRef } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
} from '../../../packages/components/ui';

import {
  AlertDemoComponent,
  ProgressDemoComponent,
  SkeletonDemoComponent,
  SpinnerDemoComponent,
  ToastDemoComponent,
  ButtonDemoComponent,
  InputDemoComponent,
  CheckboxDemoComponent,
  RadioGroupDemoComponent,
  TextareaDemoComponent,
  ToggleDemoComponent,
  SwitchDemoComponent,
  ToggleGroupDemoComponent,
  SliderDemoComponent,
  SelectDemoComponent,
  InputOtpDemoComponent,
  CalendarDemoComponent,
  DatePickerDemoComponent,
  InputMaskDemoComponent,
  SplitButtonDemoComponent,
  ChipListDemoComponent,
  RatingDemoComponent,
  ButtonGroupDemoComponent,
  InputGroupDemoComponent,
  FieldDemoComponent,
  NativeSelectDemoComponent,
  LabelDemoComponent,
  AutocompleteDemoComponent,
  TreeSelectDemoComponent,
  FormDemoComponent,
  DialogDemoComponent,
  TooltipDemoComponent,
  DropdownMenuDemoComponent,
  PopoverDemoComponent,
  SheetDemoComponent,
  AlertDialogDemoComponent,
  ContextMenuDemoComponent,
  DrawerDemoComponent,
  HoverCardDemoComponent,
  CommandDemoComponent,
  SpeedDialDemoComponent,
  TabsDemoComponent,
  StepperDemoComponent,
  PaginationDemoComponent,
  MenubarDemoComponent,
  NavigationMenuDemoComponent,
  ScrollAreaDemoComponent,
  AspectRatioDemoComponent,
  ResizableDemoComponent,
  SidebarDemoComponent,
  BentoGridDemoComponent,
  PageBuilderDemoComponent,
  PageRendererDemoComponent,
  VirtualScrollDemoComponent,
  ChartsDemoComponent,
  CardDemoComponent,
  BadgeDemoComponent,
  AvatarDemoComponent,
  TableDemoComponent,
  AccordionDemoComponent,
  CollapsibleDemoComponent,
  BreadcrumbDemoComponent,
  CarouselDemoComponent,
  CodeBlockDemoComponent,
  TreeDemoComponent,
  TreeViewDemoComponent,
  TimelineDemoComponent,
  EmptyDemoComponent,
  KbdDemoComponent,
  SeparatorDemoComponent,
  NumberTickerDemoComponent,
  DataTableDemoComponent,
  IconDemoComponent,
  EmojiPickerDemoComponent,
  RichTextEditorDemoComponent,
  FileUploadDemoComponent,
  FileViewerDemoComponent,
  ColorPickerDemoComponent,
  ConfettiDemoComponent,
  ChatDemoComponent,
  StreamingTextDemoComponent,
  SparklesDemoComponent,
  TextRevealDemoComponent,
  DockDemoComponent,
  AnimationsDemoComponent,
  KanbanDemoComponent,
} from './demos';

export type ComponentCategory = 'Inputs' | 'Data Display' | 'Feedback' | 'Overlay' | 'Navigation' | 'Layout' | 'Charts' | 'Advanced';

export interface ComponentNavItem {
  id: string;
  name: string;
  category: ComponentCategory;
  icon: string;
}

@Component({
  selector: 'app-root',
  imports: [
    TitleCasePipe,
    FormsModule,
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
    AlertDemoComponent,
    ProgressDemoComponent,
    SkeletonDemoComponent,
    SpinnerDemoComponent,
    ToastDemoComponent,
    ButtonDemoComponent,
    InputDemoComponent,
    CheckboxDemoComponent,
    RadioGroupDemoComponent,
    TextareaDemoComponent,
    ToggleDemoComponent,
    SwitchDemoComponent,
    ToggleGroupDemoComponent,
    SliderDemoComponent,
    SelectDemoComponent,
    InputOtpDemoComponent,
    CalendarDemoComponent,
    DatePickerDemoComponent,
    InputMaskDemoComponent,
    SplitButtonDemoComponent,
    ChipListDemoComponent,
    RatingDemoComponent,
    ButtonGroupDemoComponent,
    InputGroupDemoComponent,
    FieldDemoComponent,
    NativeSelectDemoComponent,
    LabelDemoComponent,
    AutocompleteDemoComponent,
    TreeSelectDemoComponent,
    FormDemoComponent,
    DialogDemoComponent,
    TooltipDemoComponent,
    DropdownMenuDemoComponent,
    PopoverDemoComponent,
    SheetDemoComponent,
    AlertDialogDemoComponent,
    ContextMenuDemoComponent,
    DrawerDemoComponent,
    HoverCardDemoComponent,
    CommandDemoComponent,
    SpeedDialDemoComponent,
    TabsDemoComponent,
    StepperDemoComponent,
    PaginationDemoComponent,
    MenubarDemoComponent,
    NavigationMenuDemoComponent,
    ScrollAreaDemoComponent,
    AspectRatioDemoComponent,
    ResizableDemoComponent,
    SidebarDemoComponent,
    BentoGridDemoComponent,
    PageBuilderDemoComponent,
    PageRendererDemoComponent,
    VirtualScrollDemoComponent,
    ChartsDemoComponent,
    CardDemoComponent,
    BadgeDemoComponent,
    AvatarDemoComponent,
    TableDemoComponent,
    AccordionDemoComponent,
    CollapsibleDemoComponent,
    BreadcrumbDemoComponent,
    CarouselDemoComponent,
    CodeBlockDemoComponent,
    TreeDemoComponent,
    TreeViewDemoComponent,
    TimelineDemoComponent,
    EmptyDemoComponent,
    KbdDemoComponent,
    SeparatorDemoComponent,
    NumberTickerDemoComponent,
    DataTableDemoComponent,
    IconDemoComponent,
    EmojiPickerDemoComponent,
    RichTextEditorDemoComponent,
    FileUploadDemoComponent,
    FileViewerDemoComponent,
    ColorPickerDemoComponent,
    ConfettiDemoComponent,
    ChatDemoComponent,
    StreamingTextDemoComponent,
    SparklesDemoComponent,
    TextRevealDemoComponent,
    DockDemoComponent,
    AnimationsDemoComponent,
    KanbanDemoComponent,
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

  readonly isDark = signal(false);
  readonly isRtl = signal(false);
  readonly showCommandDialog = signal(false);
  readonly showShortcutBindingsDialog = signal(false);
  readonly sidebarCollapseMode = signal<'icon' | 'hidden'>('icon');
  readonly activeComponent = signal(this.getComponentIdFromUrl());

  readonly componentLinks: readonly ComponentNavItem[] = [
    { id: 'emoji-picker', name: 'Emoji Picker', category: 'Advanced', icon: '😀' },
    { id: 'rich-text-editor', name: 'Rich Text Editor', category: 'Advanced', icon: '📝' },
    { id: 'autocomplete', name: 'Autocomplete', category: 'Inputs', icon: '🔍' },
    { id: 'timeline', name: 'Timeline', category: 'Data Display', icon: '📅' },
    { id: 'tree-view', name: 'Tree View', category: 'Data Display', icon: '🌳' },
    { id: 'rating', name: 'Rating', category: 'Inputs', icon: '⭐' },
    { id: 'stepper', name: 'Stepper', category: 'Navigation', icon: '👣' },
    { id: 'file-upload', name: 'File Upload', category: 'Advanced', icon: '📤' },
    { id: 'file-viewer', name: 'File Viewer', category: 'Advanced', icon: '👁' },
    { id: 'color-picker', name: 'Color Picker', category: 'Advanced', icon: '🎨' },
    { id: 'confetti', name: 'Confetti', category: 'Advanced', icon: '🎉' },
    { id: 'number-ticker', name: 'Number Ticker', category: 'Data Display', icon: '🔢' },
    { id: 'charts', name: 'Charts', category: 'Charts', icon: '📊' },
    { id: 'buttons', name: 'Buttons', category: 'Inputs', icon: '🔘' },
    { id: 'chat', name: 'Chat', category: 'Advanced', icon: '💬' },
    { id: 'streaming-text', name: 'Streaming Text', category: 'Advanced', icon: '⌨️' },
    { id: 'form', name: 'Form', category: 'Inputs', icon: '📋' },
    { id: 'input', name: 'Input', category: 'Inputs', icon: '✏️' },
    { id: 'input-mask', name: 'Input Mask', category: 'Inputs', icon: '🎭' },
    { id: 'split-button', name: 'Split Button', category: 'Inputs', icon: '🔽' },
    { id: 'chip-list', name: 'Chip List', category: 'Inputs', icon: '🏷️' },
    { id: 'card', name: 'Card', category: 'Data Display', icon: '🃏' },
    { id: 'badge', name: 'Badge', category: 'Data Display', icon: '🔖' },
    { id: 'checkbox', name: 'Checkbox', category: 'Inputs', icon: '☑️' },
    { id: 'radio-group', name: 'Radio Group', category: 'Inputs', icon: '🔘' },
    { id: 'textarea', name: 'Textarea', category: 'Inputs', icon: '📄' },
    { id: 'skeleton', name: 'Skeleton', category: 'Feedback', icon: '💀' },
    { id: 'tabs', name: 'Tabs', category: 'Navigation', icon: '📑' },
    { id: 'accordion', name: 'Accordion', category: 'Data Display', icon: '🪗' },
    { id: 'progress', name: 'Progress', category: 'Feedback', icon: '📈' },
    { id: 'alert', name: 'Alert', category: 'Feedback', icon: '⚠️' },
    { id: 'avatar', name: 'Avatar', category: 'Data Display', icon: '👤' },
    { id: 'dialog', name: 'Dialog', category: 'Overlay', icon: '💭' },
    { id: 'tooltip', name: 'Tooltip', category: 'Overlay', icon: '💡' },
    { id: 'dropdown-menu', name: 'Dropdown Menu', category: 'Overlay', icon: '📜' },
    { id: 'select', name: 'Select', category: 'Inputs', icon: '📋' },
    { id: 'popover', name: 'Popover', category: 'Overlay', icon: '🗨️' },
    { id: 'sparkles', name: 'Sparkles', category: 'Advanced', icon: '✨' },
    { id: 'text-reveal', name: 'Text Reveal', category: 'Advanced', icon: '👁️' },
    { id: 'code-block', name: 'Code Block', category: 'Data Display', icon: '💻' },
    { id: 'sheet', name: 'Sheet', category: 'Overlay', icon: '📃' },
    { id: 'alert-dialog', name: 'Alert Dialog', category: 'Overlay', icon: '🚨' },
    { id: 'slider', name: 'Slider', category: 'Inputs', icon: '🎚️' },
    { id: 'collapsible', name: 'Collapsible', category: 'Data Display', icon: '📂' },
    { id: 'toggle', name: 'Toggle', category: 'Inputs', icon: '🔀' },
    { id: 'switch', name: 'Switch', category: 'Inputs', icon: '⚡' },
    { id: 'toggle-group', name: 'Toggle Group', category: 'Inputs', icon: '🎛️' },
    { id: 'scroll-area', name: 'Scroll Area', category: 'Layout', icon: '📜' },
    { id: 'table', name: 'Table', category: 'Data Display', icon: '📊' },
    { id: 'breadcrumb', name: 'Breadcrumb', category: 'Navigation', icon: '🍞' },
    { id: 'hover-card', name: 'Hover Card', category: 'Overlay', icon: '🖱️' },
    { id: 'context-menu', name: 'Context Menu', category: 'Overlay', icon: '📋' },
    { id: 'drawer', name: 'Drawer', category: 'Overlay', icon: '🗄️' },
    { id: 'aspect-ratio', name: 'Aspect Ratio', category: 'Layout', icon: '📐' },
    { id: 'toast', name: 'Toast', category: 'Feedback', icon: '🍞' },
    { id: 'resizable', name: 'Resizable', category: 'Layout', icon: '↔️' },
    { id: 'pagination', name: 'Pagination', category: 'Navigation', icon: '📄' },
    { id: 'input-otp', name: 'Input OTP', category: 'Inputs', icon: '🔐' },
    { id: 'calendar', name: 'Calendar', category: 'Inputs', icon: '📆' },
    { id: 'command', name: 'Command', category: 'Overlay', icon: '⌘' },
    { id: 'menubar', name: 'Menubar', category: 'Navigation', icon: '☰' },
    { id: 'carousel', name: 'Carousel', category: 'Data Display', icon: '🎠' },
    { id: 'navigation-menu', name: 'Navigation Menu', category: 'Navigation', icon: '🧭' },
    { id: 'date-picker', name: 'Date Picker', category: 'Inputs', icon: '📅' },
    { id: 'sidebar', name: 'Sidebar', category: 'Layout', icon: '📎' },
    { id: 'spinner', name: 'Spinner', category: 'Feedback', icon: '🔄' },
    { id: 'empty', name: 'Empty', category: 'Data Display', icon: '📭' },
    { id: 'kbd', name: 'Kbd', category: 'Data Display', icon: '⌨️' },
    { id: 'button-group', name: 'Button Group', category: 'Inputs', icon: '🔲' },
    { id: 'input-group', name: 'Input Group', category: 'Inputs', icon: '📥' },
    { id: 'field', name: 'Field', category: 'Inputs', icon: '📝' },
    { id: 'native-select', name: 'Native Select', category: 'Inputs', icon: '📋' },
    { id: 'speed-dial', name: 'Speed Dial', category: 'Overlay', icon: '📞' },
    { id: 'data-table', name: 'Data Table', category: 'Data Display', icon: '📊' },
    { id: 'separator', name: 'Separator', category: 'Data Display', icon: '➖' },
    { id: 'label', name: 'Label', category: 'Inputs', icon: '🏷️' },
    { id: 'tree-select', name: 'Tree Select', category: 'Inputs', icon: '🌲' },
    { id: 'tree', name: 'Tree', category: 'Data Display', icon: '🌳' },
    { id: 'dock', name: 'Dock', category: 'Advanced', icon: '⚓' },
    { id: 'bento-grid', name: 'Bento Grid', category: 'Layout', icon: '🍱' },
    { id: 'page-builder', name: 'Page Builder', category: 'Layout', icon: '🏗️' },
    { id: 'page-renderer', name: 'Page Renderer', icon: '📄', category: 'Layout' },
    { id: 'virtual-scroll', name: 'Virtual Scroll', category: 'Layout', icon: '📜' },
    { id: 'animations', name: 'Animations', category: 'Advanced', icon: '🎬' },
    { id: 'kanban', name: 'Kanban Board', category: 'Advanced', icon: '📋' },
    { id: 'icon', name: 'Icon', category: 'Data Display', icon: '🎯' },
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

    this.updateDocumentTitle(this.activeComponent());
    const destroyRef = inject(DestroyRef);
    const onPopState = () => {
      const id = this.getComponentIdFromUrl();
      this.activeComponent.set(id);
      this.updateDocumentTitle(id);
    };
    globalThis.addEventListener('popstate', onPopState);
    destroyRef.onDestroy(() => globalThis.removeEventListener('popstate', onPopState));
  }

  onKeydown(e: KeyboardEvent) {
    this.shortcutBindings.dispatch(e);
  }

  toggleTheme(checked: boolean) {
    this.isDark.set(checked);
    if (checked) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  toggleDirection(checked: boolean) {
    this.isRtl.set(checked);
    document.documentElement.dir = checked ? 'rtl' : 'ltr';
  }

  navTo(id: string) {
    this.activeComponent.set(id);
    this.showCommandDialog.set(false);
    history.pushState(null, '', id === 'introduction' ? '/' : `/${id}`);
    this.updateDocumentTitle(id);
  }

  getLinksByCategory(category: string) {
    return this.linksByCategory().get(category) ?? [];
  }

  private getComponentIdFromUrl(): string {
    const path = globalThis.location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    return path || 'introduction';
  }

  private updateDocumentTitle(id: string) {
    const link = this.componentLinks.find(l => l.id === id);
    document.title = link ? `${link.name} - shadcn-angular` : 'shadcn-angular';
  }
}
