import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ButtonComponent,
  InputComponent,
  CardComponent,
  CardHeaderComponent,
  CardTitleComponent,
  CardDescriptionComponent,
  CardContentComponent,
  CardFooterComponent,
  BadgeComponent,
  LabelComponent,
  SeparatorComponent,
  SwitchComponent,
  CheckboxComponent,
  RadioGroupComponent,
  RadioGroupItemComponent,
  TextareaComponent,
  SkeletonComponent,
  TabsComponent,
  TabsListComponent,
  TabsTriggerComponent,
  TabsContentComponent,
  AccordionComponent,
  AccordionItemComponent,
  AccordionTriggerComponent,
  AccordionContentComponent,
  ProgressComponent,
  AlertComponent,
  AlertTitleComponent,
  AlertDescriptionComponent,
  AvatarComponent,
  AvatarImageComponent,
  AvatarFallbackComponent,
  DialogComponent,
  DialogTriggerComponent,
  DialogContentComponent,
  DialogHeaderComponent,
  DialogTitleComponent,
  DialogDescriptionComponent,
  DialogFooterComponent,
  TooltipDirective,
  DropdownMenuComponent,
  DropdownMenuTriggerComponent,
  DropdownMenuContentComponent,
  DropdownMenuItemComponent,
  DropdownMenuSeparatorComponent,
  DropdownMenuLabelComponent,
  DropdownMenuSubComponent,
  DropdownMenuSubTriggerComponent,
  DropdownMenuSubContentComponent,
  SelectComponent,
  SelectTriggerComponent,
  SelectValueComponent,
  SelectContentComponent,
  SelectItemComponent,
  SelectGroupComponent,
  SelectLabelComponent,
  PopoverComponent,
  PopoverTriggerComponent,
  PopoverContentComponent,
  PopoverCloseComponent,
  SheetComponent,
  SheetTriggerComponent,
  SheetContentComponent,
  SheetHeaderComponent,
  SheetTitleComponent,
  SheetDescriptionComponent,
  SheetFooterComponent,
  SheetCloseComponent,
  AlertDialogComponent,
  AlertDialogTriggerComponent,
  AlertDialogContentComponent,
  AlertDialogHeaderComponent,
  AlertDialogTitleComponent,
  AlertDialogDescriptionComponent,
  AlertDialogFooterComponent,
  AlertDialogActionComponent,
  AlertDialogCancelComponent,
  SliderComponent,
  CollapsibleComponent,
  CollapsibleTriggerComponent,
  CollapsibleContentComponent,
  ContextMenuTriggerDirective,
  ToggleComponent,
  ToggleGroupComponent,
  ToggleGroupItemComponent,
  ScrollAreaComponent,
  TableComponent,
  TableHeaderComponent,
  TableBodyComponent,
  TableRowComponent,
  TableHeadComponent,
  TableCellComponent,
  TableCaptionComponent,
  BreadcrumbComponent,
  BreadcrumbListComponent,
  BreadcrumbItemComponent,
  BreadcrumbLinkComponent,
  BreadcrumbPageComponent,
  BreadcrumbSeparatorComponent,
  HoverCardComponent,
  HoverCardTriggerComponent,
  HoverCardContentComponent,
  ContextMenuComponent,
  ContextMenuTriggerComponent,
  ContextMenuContentComponent,
  ContextMenuItemComponent,
  ContextMenuSeparatorComponent,
  ContextMenuShortcutComponent,
  DrawerComponent,
  DrawerTriggerComponent,
  DrawerContentComponent,
  DrawerHeaderComponent,
  DrawerTitleComponent,
  DrawerDescriptionComponent,
  DrawerFooterComponent,
  DrawerCloseComponent,
  TooltipComponent,
  TooltipContentComponent,
  TooltipTriggerComponent,
  AspectRatioComponent,
  ToasterComponent,
  ToastService,
  ResizablePanelGroupComponent,
  ResizablePanelComponent,
  ResizableHandleComponent,
  PaginationComponent,
  PaginationContentComponent,
  PaginationItemComponent,
  PaginationLinkComponent,
  PaginationPreviousComponent,
  PaginationNextComponent,
  PaginationEllipsisComponent,
  InputOTPComponent,
  CalendarComponent,
  CommandComponent,
  CommandInputComponent,
  CommandListComponent,
  CommandEmptyComponent,
  CommandGroupComponent,
  CommandItemComponent,
  CommandSeparatorComponent,
  CommandShortcutComponent,
  CommandDialogComponent,
  MenubarComponent,
  MenubarMenuComponent,
  MenubarTriggerComponent,
  MenubarContentComponent,
  MenubarItemComponent,
  MenubarSeparatorComponent,
  MenubarShortcutComponent,
  MenubarSubComponent,
  MenubarSubTriggerComponent,
  MenubarSubContentComponent,
  CarouselComponent,
  CarouselContentComponent,
  CarouselItemComponent,
  CarouselPreviousComponent,
  CarouselNextComponent,
  NavigationMenuComponent,
  NavigationMenuListComponent,
  NavigationMenuItemComponent,
  NavigationMenuTriggerComponent,
  NavigationMenuContentComponent,
  NavigationMenuLinkComponent,
  DatePickerComponent,
  DateRangePickerComponent,
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
  SidebarMenuLinkComponent,
  SidebarTriggerComponent,
  SidebarInsetComponent,
  SidebarSeparatorComponent,
  SpinnerComponent,
  EmptyComponent,
  EmptyHeaderComponent,
  EmptyMediaComponent,
  EmptyTitleComponent,
  EmptyDescriptionComponent,
  EmptyContentComponent,
  KbdComponent,
  ButtonGroupComponent,
  ButtonGroupTextComponent,
  InputGroupComponent,
  InputGroupInputComponent,
  InputGroupAddonComponent,
  InputGroupTextComponent,
  FieldComponent,
  FieldGroupComponent,
  FieldSetComponent,
  FieldLabelComponent,
  FieldLegendComponent,
  FieldDescriptionComponent,
  FieldErrorComponent,
  FieldSeparatorComponent,
  NativeSelectComponent,
  SpeedDialComponent,
  SpeedDialTriggerComponent,
  SpeedDialMenuComponent,
  SpeedDialItemComponent,
  SpeedDialContextTriggerDirective,
  ChipListComponent,
  EmojiPickerComponent,
  EmojiPickerContentComponent,
  EmojiPickerTriggerComponent,
  RichTextEditorComponent,
  AutocompleteComponent,
  MentionItem,
  TagItem,
  TimelineComponent,
  TimelineItemComponent,
  TimelineConnectorComponent,
  TimelineDotComponent,
  TimelineHeaderComponent,
  TimelineContentComponent,
  TimelineTitleComponent,
  TimelineDescriptionComponent,
  TimelineTimeComponent,
  TreeComponent,
  TreeItemComponent,
  TreeLabelComponent,
  TreeIconComponent,
  RatingComponent,
  StepperComponent,
  StepperItemComponent,
  StepperTriggerComponent,
  StepperTitleComponent,
  StepperDescriptionComponent,
  StepperContentComponent,
  FileUploadComponent,
  ColorPickerComponent
} from '../components/ui';
import { UiConfettiDirective } from "@/components/ui/confetti.directive";

interface Framework {
  value: string;
  label: string;
}

@Component({
  selector: 'app-root',
  imports: [
    JsonPipe,
    FormsModule,
    ButtonComponent,
    InputComponent,
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardDescriptionComponent,
    CardContentComponent,
    CardFooterComponent,
    BadgeComponent,
    LabelComponent,
    SeparatorComponent,
    SwitchComponent,
    CheckboxComponent,
    RadioGroupComponent,
    RadioGroupItemComponent,
    TextareaComponent,
    SkeletonComponent,
    TabsComponent,
    TabsListComponent,
    TabsTriggerComponent,
    TabsContentComponent,
    AccordionComponent,
    AccordionItemComponent,
    AccordionTriggerComponent,
    AccordionContentComponent,
    ProgressComponent,
    AlertComponent,
    AlertTitleComponent,
    AlertDescriptionComponent,
    AvatarComponent,
    AvatarImageComponent,
    AvatarFallbackComponent,
    DialogComponent,
    DialogTriggerComponent,
    DialogContentComponent,
    DialogHeaderComponent,
    DialogTitleComponent,
    DialogDescriptionComponent,
    DialogFooterComponent,
    TooltipDirective,
    DropdownMenuComponent,
    DropdownMenuTriggerComponent,
    DropdownMenuContentComponent,
    DropdownMenuItemComponent,
    DropdownMenuSeparatorComponent,
    DropdownMenuLabelComponent,
    DropdownMenuSubComponent,
    DropdownMenuSubTriggerComponent,
    DropdownMenuSubContentComponent,
    SelectComponent,
    SelectTriggerComponent,
    SelectValueComponent,
    SelectContentComponent,
    SelectItemComponent,
    SelectGroupComponent,
    SelectLabelComponent,
    PopoverComponent,
    PopoverTriggerComponent,
    PopoverContentComponent,
    PopoverCloseComponent,
    SheetComponent,
    SheetTriggerComponent,
    SheetContentComponent,
    SheetHeaderComponent,
    SheetTitleComponent,
    SheetDescriptionComponent,
    SheetFooterComponent,
    SheetCloseComponent,
    AlertDialogComponent,
    AlertDialogTriggerComponent,
    AlertDialogContentComponent,
    AlertDialogHeaderComponent,
    AlertDialogTitleComponent,
    AlertDialogDescriptionComponent,
    AlertDialogFooterComponent,
    AlertDialogActionComponent,
    AlertDialogCancelComponent,
    SliderComponent,
    CollapsibleComponent,
    CollapsibleTriggerComponent,
    CollapsibleContentComponent,
    ToggleComponent,
    ToggleGroupComponent,
    ToggleGroupItemComponent,
    ScrollAreaComponent,
    TableComponent,
    TableHeaderComponent,
    TableBodyComponent,
    TableRowComponent,
    TableHeadComponent,
    TableCellComponent,
    TableCaptionComponent,
    BreadcrumbComponent,
    BreadcrumbListComponent,
    BreadcrumbItemComponent,
    BreadcrumbLinkComponent,
    BreadcrumbPageComponent,
    BreadcrumbSeparatorComponent,
    HoverCardComponent,
    HoverCardTriggerComponent,
    HoverCardContentComponent,
    ContextMenuComponent,
    ContextMenuTriggerComponent,
    ContextMenuContentComponent,
    ContextMenuItemComponent,
    ContextMenuSeparatorComponent,
    ContextMenuShortcutComponent,
    DrawerComponent,
    DrawerTriggerComponent,
    DrawerContentComponent,
    DrawerHeaderComponent,
    DrawerTitleComponent,
    DrawerDescriptionComponent,
    DrawerFooterComponent,
    DrawerCloseComponent,
    AspectRatioComponent,
    ToasterComponent,
    ResizablePanelGroupComponent,
    ResizablePanelComponent,
    ResizableHandleComponent,
    PaginationComponent,
    PaginationContentComponent,
    PaginationItemComponent,
    PaginationLinkComponent,
    PaginationPreviousComponent,
    PaginationNextComponent,
    PaginationEllipsisComponent,
    InputOTPComponent,
    CalendarComponent,
    CommandComponent,
    CommandInputComponent,
    CommandListComponent,
    CommandEmptyComponent,
    CommandGroupComponent,
    CommandItemComponent,
    CommandSeparatorComponent,
    CommandShortcutComponent,
    CommandDialogComponent,
    MenubarComponent,
    MenubarMenuComponent,
    MenubarTriggerComponent,
    MenubarContentComponent,
    MenubarItemComponent,
    MenubarSeparatorComponent,
    MenubarShortcutComponent,
    MenubarSubComponent,
    MenubarSubTriggerComponent,
    MenubarSubContentComponent,
    CarouselComponent,
    CarouselContentComponent,
    CarouselItemComponent,
    CarouselPreviousComponent,
    CarouselNextComponent,
    NavigationMenuComponent,
    NavigationMenuListComponent,
    NavigationMenuItemComponent,
    NavigationMenuTriggerComponent,
    NavigationMenuContentComponent,
    NavigationMenuLinkComponent,
    DatePickerComponent,
    DateRangePickerComponent,
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
    SidebarMenuLinkComponent,
    SidebarTriggerComponent,
    SidebarInsetComponent,
    SidebarSeparatorComponent,
    SpinnerComponent,
    EmptyComponent,
    EmptyHeaderComponent,
    EmptyMediaComponent,
    EmptyTitleComponent,
    EmptyDescriptionComponent,
    EmptyContentComponent,
    KbdComponent,
    ButtonGroupComponent,
    ButtonGroupTextComponent,
    InputGroupComponent,
    InputGroupInputComponent,
    InputGroupAddonComponent,
    InputGroupTextComponent,
    FieldComponent,
    FieldGroupComponent,
    FieldSetComponent,
    FieldLabelComponent,
    FieldLegendComponent,
    FieldDescriptionComponent,
    FieldErrorComponent,
    FieldSeparatorComponent,
    NativeSelectComponent,
    SpeedDialComponent,
    SpeedDialTriggerComponent,
    SpeedDialMenuComponent,
    SpeedDialItemComponent,
    SpeedDialContextTriggerDirective,
    TooltipComponent,
    TooltipContentComponent,
    TooltipTriggerComponent,
    TooltipDirective,
    ContextMenuTriggerDirective,
    ChipListComponent,
    EmojiPickerComponent,
    EmojiPickerContentComponent,
    EmojiPickerTriggerComponent,
    RichTextEditorComponent,
    AutocompleteComponent,
    TimelineComponent,
    TimelineItemComponent,
    TimelineConnectorComponent,
    TimelineDotComponent,
    TimelineHeaderComponent,
    TimelineContentComponent,
    TimelineTitleComponent,
    TimelineDescriptionComponent,
    TimelineTimeComponent,
    TreeComponent,
    TreeItemComponent,
    TreeLabelComponent,
    TreeIconComponent,
    RatingComponent,
    StepperComponent,
    StepperItemComponent,
    StepperTriggerComponent,
    StepperTitleComponent,
    StepperDescriptionComponent,
    StepperContentComponent,
    FileUploadComponent,
    ColorPickerComponent,
    UiConfettiDirective
  ],

  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class AppComponent {
  private toastService = inject(ToastService);
  isDark = signal(false);

  verticalTopSize = signal(40);
  verticalBottomSize = signal(60);

  chipListTags = signal<string[]>(['Angular', 'TypeScript', 'Signals']);
  chipListFruits = signal<string[]>([
    'Apple',
    'Banana',
    'Cherry',
    'Date',
    'Elderberry',
    'Fig',
    'Grape',
    'Honeydew',
  ]);

  isRtl = signal(false);
  selectedEmoji = signal<string | null>(null);
  closeOnSelect = signal(true);

  constructor() {
    console.log('test');
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

  onEmojiSelect(emoji: string) {
    this.selectedEmoji.set(emoji);
  }

  showToast(type: 'default' | 'success' | 'error') {
    switch (type) {
      case 'success':
        this.toastService.success('Success!', 'Your action was completed successfully.');
        break;
      case 'error':
        this.toastService.error('Error', 'Something went wrong. Please try again.');
        break;
      default:
        this.toastService.toast({ title: 'Notification', description: 'This is a toast message.' });
    }
  }

  onVerticalResize(event: { delta: number; sizes: number[] }) {
    this.verticalTopSize.set(event.sizes[0]);
    this.verticalBottomSize.set(event.sizes[1]);
  }

  showCommandDialog = signal(false);

  // Rich Text Editor demo data
  richTextContent = '';
  richTextHtml = '';
  sampleMentions: MentionItem[] = [
    { id: '1', value: 'john', label: 'John Doe', description: 'john@example.com' },
    { id: '2', value: 'jane', label: 'Jane Smith', description: 'jane@example.com' },
    { id: '3', value: 'bob', label: 'Bob Wilson', description: 'bob@example.com' },
  ];
  sampleTags: TagItem[] = [
    { id: '1', value: 'angular', label: 'Angular', color: '#dd0031' },
    { id: '2', value: 'typescript', label: 'TypeScript', color: '#3178c6' },
    { id: '3', value: 'tailwind', label: 'TailwindCSS', color: '#06b6d4' },
  ];

  links = [
    { title: 'Accordion', id: 'accordion' },
    { title: 'Alert', id: 'alert' },
    { title: 'Alert Dialog', id: 'alert-dialog' },
    { title: 'Aspect Ratio', id: 'aspect-ratio' },
    { title: 'Avatar', id: 'avatar' },
    { title: 'Badge', id: 'badge' },
    { title: 'Breadcrumb', id: 'breadcrumb' },
    { title: 'Button', id: 'buttons' },
    { title: 'Button Group', id: 'button-group' },
    { title: 'Calendar', id: 'calendar' },
    { title: 'Card', id: 'card' },
    { title: 'Carousel', id: 'carousel' },
    { title: 'Checkbox', id: 'checkbox' },
    { title: 'Chip List', id: 'chip-list' },
    { title: 'Collapsible', id: 'collapsible' },
    { title: 'Command', id: 'command' },
    { title: 'Context Menu', id: 'context-menu' },
    { title: 'Date Picker', id: 'date-picker' },
    { title: 'Dialog', id: 'dialog' },
    { title: 'Drawer', id: 'drawer' },
    { title: 'Dropdown Menu', id: 'dropdown-menu' },
    { title: 'Emoji Picker', id: 'emoji-picker' },
    { title: 'Empty State', id: 'empty-state' },
    { title: 'Field', id: 'field' },
    { title: 'Hover Card', id: 'hover-card' },
    { title: 'Input', id: 'input' },
    { title: 'Input Group', id: 'input-group' },
    { title: 'Input OTP', id: 'input-otp' },
    { title: 'Keyboard Shortcut', id: 'keyboard-shortcut' },
    { title: 'Menubar', id: 'menubar' },
    { title: 'Native Select', id: 'native-select' },
    { title: 'Navigation Menu', id: 'navigation-menu' },
    { title: 'Pagination', id: 'pagination' },
    { title: 'Popover', id: 'popover' },
    { title: 'Progress', id: 'progress' },
    { title: 'Radio Group', id: 'radio-group' },
    { title: 'Resizable', id: 'resizable' },
    { title: 'Rich Text Editor', id: 'rich-text-editor' },
    { title: 'Scroll Area', id: 'scroll-area' },
    { title: 'Select', id: 'select' },
    { title: 'Sheet', id: 'sheet' },
    { title: 'Sidebar', id: 'sidebar' },
    { title: 'Skeleton', id: 'skeleton' },
    { title: 'Slider', id: 'slider' },
    { title: 'Speed Dial', id: 'speed-dial' },
    { title: 'Spinner', id: 'spinner' },
    { title: 'Table', id: 'table' },
    { title: 'Tabs', id: 'tabs' },
    { title: 'Textarea', id: 'textarea' },
    { title: 'Toast', id: 'toast' },
    { title: 'Toggle', id: 'toggle' },
    { title: 'Toggle Group', id: 'toggle-group' },
    { title: 'Tooltip', id: 'tooltip' },
    { title: 'Autocomplete', id: 'autocomplete' },
    { title: 'Timeline', id: 'timeline' },
    { title: 'Tree View', id: 'tree-view' },
    { title: 'Rating', id: 'rating' },
    { title: 'Stepper', id: 'stepper' },
    { title: 'File Upload', id: 'file-upload' },
    { title: 'Color Picker', id: 'color-picker' },
    { title: 'Confetti', id: 'confetti' },
  ];

  onKeydown(e: KeyboardEvent) {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      this.showCommandDialog.update((v) => !v);
    }
  }

  scrollToSection(id: string) {
    this.showCommandDialog.set(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Autocomplete Demo
  frameworks = signal<Framework[]>([
    { value: 'next.js', label: 'Next.js' },
    { value: 'sveltekit', label: 'SvelteKit' },
    { value: 'nuxt.js', label: 'Nuxt.js' },
    { value: 'remix', label: 'Remix' },
    { value: 'astro', label: 'Astro' },
    { value: 'angular', label: 'Angular' },
    { value: 'vue', label: 'Vue' },
    { value: 'react', label: 'React' },
  ]);

  selectedFramework = signal<Framework | null>(null);
  selectedFrameworks = signal<Framework[]>([this.frameworks()[0], this.frameworks()[5]]);

  displayFn(option: unknown): string {
    return (option as Framework)?.label || '';
  }

  writeToLog(str: string) {
    console.log(str);
  }

  // New Component Demo State
  demoRating = signal(3);
  demoRatingHalf = signal(2.5);
  activeStep = signal(0);
  demoColor = signal('#3b82f6');
  colorPresets = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

  // Confetti Demo
  confettiTrigger1 = signal(false);
  confettiTrigger2 = signal(false);
  confettiTrigger3 = signal(false);
  confettiTrigger4 = signal(false);

  fireConfetti1() {
    this.confettiTrigger1.set(false);
    setTimeout(() => this.confettiTrigger1.set(true), 0);
  }

  fireConfetti2() {
    this.confettiTrigger2.set(false);
    setTimeout(() => this.confettiTrigger2.set(true), 0);
  }

  fireConfetti3() {
    this.confettiTrigger3.set(false);
    setTimeout(() => this.confettiTrigger3.set(true), 0);
  }

  fireConfetti4() {
    this.confettiTrigger4.set(false);
    setTimeout(() => this.confettiTrigger4.set(true), 0);
  }
}
