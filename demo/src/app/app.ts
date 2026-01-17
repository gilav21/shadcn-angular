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
import { NumberTickerComponent } from '@/components/ui/number-ticker.component';
import {
  PieChartComponent,
  PieChartDrilldownComponent,
  BarChartComponent,
  BarChartDrilldownComponent,
  StackedBarChartComponent,
  ColumnRangeChartComponent,
  BarRaceChartComponent,
  ChartDataPoint,
  DrilldownDataPoint,
  DrilldownSeries,
  ChartSeries,
  RangeDataPoint,
} from '@/components/ui/charts';

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
    UiConfettiDirective,
    NumberTickerComponent,
    PieChartComponent,
    PieChartDrilldownComponent,
    BarChartComponent,
    BarChartDrilldownComponent,
    StackedBarChartComponent,
    ColumnRangeChartComponent,
    BarRaceChartComponent,
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
    { title: 'Charts', id: 'charts' },
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

  // Subscribers Demo
  subscribersValue = signal(8549);

  // Chart Demo Data
  pieChartData: ChartDataPoint[] = [
    { name: 'Chrome', value: 61.41 },
    { name: 'Safari', value: 24.43 },
    { name: 'Edge', value: 6.28 },
    { name: 'Firefox', value: 4.14 },
    { name: 'Other', value: 3.74 },
  ];

  drilldownData: DrilldownDataPoint[] = [
    { name: 'Chrome', value: 61, drilldown: 'chrome' },
    { name: 'Safari', value: 24, drilldown: 'safari' },
    { name: 'Edge', value: 6, drilldown: 'edge' },
    { name: 'Firefox', value: 5 },
    { name: 'Other', value: 4 },
  ];

  drilldownSeries: DrilldownSeries[] = [
    {
      id: 'chrome', name: 'Chrome Versions', data: [
        { name: 'v120', value: 35 }, { name: 'v119', value: 15 }, { name: 'v118', value: 8 }, { name: 'v117', value: 3 }
      ]
    },
    {
      id: 'safari', name: 'Safari Versions', data: [
        { name: 'v17', value: 18 }, { name: 'v16', value: 5 }, { name: 'v15', value: 1 }
      ]
    },
    {
      id: 'edge', name: 'Edge Versions', data: [
        { name: 'v120', value: 4 }, { name: 'v119', value: 1.5 }, { name: 'v118', value: 0.5 }
      ]
    },
  ];

  barChartData: ChartDataPoint[] = [
    { name: 'Jan', value: 4500 },
    { name: 'Feb', value: 3800 },
    { name: 'Mar', value: 5200 },
    { name: 'Apr', value: 4800 },
    { name: 'May', value: 6100 },
    { name: 'Jun', value: 5500 },
  ];

  stackedSeries: ChartSeries[] = [
    {
      name: 'Desktop', data: [
        { name: 'Q1', value: 50 }, { name: 'Q2', value: 55 }, { name: 'Q3', value: 60 }, { name: 'Q4', value: 65 }
      ]
    },
    {
      name: 'Mobile', data: [
        { name: 'Q1', value: 40 }, { name: 'Q2', value: 50 }, { name: 'Q3', value: 55 }, { name: 'Q4', value: 68 }
      ]
    },
    {
      name: 'Tablet', data: [
        { name: 'Q1', value: 10 }, { name: 'Q2', value: 12 }, { name: 'Q3', value: 8 }, { name: 'Q4', value: 10 }
      ]
    },
  ];
  stackedCategories = ['Q1', 'Q2', 'Q3', 'Q4'];

  rangeChartData: RangeDataPoint[] = [
    { name: 'Jan', low: -5, high: 5 },
    { name: 'Feb', low: -3, high: 8 },
    { name: 'Mar', low: 2, high: 14 },
    { name: 'Apr', low: 8, high: 20 },
    { name: 'May', low: 13, high: 25 },
    { name: 'Jun', low: 18, high: 30 },
  ];

  barRaceFrames: ChartDataPoint[][] = [
    [{ name: 'Alice', value: 45 }, { name: 'Bob', value: 30 }, { name: 'Charlie', value: 55 }, { name: 'Diana', value: 40 }, { name: 'Eve', value: 25 }, { name: 'Frank', value: 10 }],
    [{ name: 'Alice', value: 82 }, { name: 'Bob', value: 68 }, { name: 'Charlie', value: 71 }, { name: 'Diana', value: 90 }, { name: 'Eve', value: 55 }, { name: 'Frank', value: 15 }],
    [{ name: 'Alice', value: 120 }, { name: 'Bob', value: 145 }, { name: 'Charlie', value: 98 }, { name: 'Diana', value: 130 }, { name: 'Eve', value: 88 }, { name: 'Frank', value: 20 }],
    [{ name: 'Alice', value: 175 }, { name: 'Bob', value: 190 }, { name: 'Charlie', value: 155 }, { name: 'Diana', value: 168 }, { name: 'Eve', value: 142 }, { name: 'Frank', value: 25 }],
    [{ name: 'Alice', value: 220 }, { name: 'Bob', value: 245 }, { name: 'Charlie', value: 200 }, { name: 'Diana', value: 230 }, { name: 'Eve', value: 212 }, { name: 'Frank', value: 30 }],
    [{ name: 'Alice', value: 265 }, { name: 'Bob', value: 290 }, { name: 'Charlie', value: 255 }, { name: 'Diana', value: 278 }, { name: 'Eve', value: 262 }, { name: 'Frank', value: 35 }],
  ];
  barRaceLabels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'];

  constructor() {
    console.log('AppComponent initialized');

    // Simulate subscribers increasing
    setInterval(() => {
      this.subscribersValue.update(v => v + Math.floor(Math.random() * 3) + 1);
    }, 5000);
  }
}
