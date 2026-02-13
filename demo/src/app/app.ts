import { Component, ChangeDetectionStrategy, signal, inject, computed, effect, input, viewChild } from '@angular/core';
import { JsonPipe, TitleCasePipe, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { delay, of } from 'rxjs';
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
  DropdownItem,
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
  COMMAND_DIALOG_SHORTCUT_DEFINITIONS,
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
  RICH_TEXT_SHORTCUT_DEFINITIONS,
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
  ColorPickerComponent,
  DataTableComponent,
  DataTableContextMenuDirective,
  ColumnDef,
  DataTableColumnState,
  DataTableLoadingVisibility,
  ColumnResizeEvent,
  SortState,
  PaginationState,
  ChatMessageComponent,
  ChatListComponent,
  ChatInputComponent,
  SparklesButtonComponent,
  StreamingTextComponent,
  TextRevealComponent,
  CodeBlockComponent,
  CODE_BLOCK_THEMES,
  SidebarMenuButtonComponent,
  SkeletonComponent,
  TreeSelectComponent,
  InputMaskDirective,
  SplitButtonComponent,
  SplitButtonPrimaryComponent,
  SplitButtonMenuComponent,
  SplitButtonItemComponent,
  SplitButtonItem,
  TreeNode,
  VirtualScrollState,
  VirtualScrollComponent,
  VirtualItemDirective,
  ContextMenuIntegrations,
  DockComponent,
  DockItemComponent,
  DockIconComponent,
  DockLabelComponent,
  PageBuilderComponent,
  ComponentMeta,
  ShortcutBindingService,
  ShortcutBindingsDialogComponent
} from '../../../packages/components/ui';
import {
  MetricWidgetComponent,
  CalendarWidgetComponent,
  TeamWidgetComponent,
  ActivityWidgetComponent,
  ActionWidgetComponent
} from './dashboard-widgets';
import { PageViewerDemoComponent } from './page-viewer-demo.component';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UiConfettiDirective } from "../../../packages/components/ui/confetti.directive";
import {
  BentoGridComponent,
  DashboardItem,
} from '../../../packages/components/ui/bento-grid.component';
import { NumberTickerComponent } from '../../../packages/components/ui/number-ticker.component';
import { StatusCellComponent } from './cells/status-cell.component';
import { AmountCellComponent } from './cells/amount-cell.component';
import { ActionsCellComponent } from './cells/actions-cell.component';
import { TextFilterComponent } from './filters/text-filter.component';
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
} from '../../../packages/components/ui/charts';


interface VirtualScrollItem {
  id: number;
  title: string;
  description: string;
  height: number;
  type: string;
  color: string;
  author?: string;
  avatar?: string;
  timestamp?: string;
  likes?: number;
  comments?: number;
  shares?: number;
  paragraphs?: string[];
  images?: { url: string; caption: string }[];
  tags?: string[];
  subItems?: { id: number; name: string }[];
  imageSize?: string;
  chartData?: { month: string; value: number }[];
  expandedContent?: string;
}


@Component({
  selector: 'app-tabs-demo',
  standalone: true,
  imports: [CardComponent, CardHeaderComponent, CardTitleComponent, CardDescriptionComponent, CardContentComponent, ButtonComponent, InputComponent, LabelComponent, FormsModule],
  template: `
    <ui-card>
      <ui-card-header>
        <ui-card-title>Account Settings</ui-card-title>
        <ui-card-description>Manage your account settings and preferences.</ui-card-description>
      </ui-card-header>
      <ui-card-content class="space-y-2">
        <div class="space-y-1">
          <ui-label>Username</ui-label>
          <ui-input [ngModel]="username()" readonly />
        </div>
        <div class="space-y-1">
          <ui-label>Email</ui-label>
          <ui-input ngModel="user@example.com" />
        </div>
        <ui-button class="mt-4">Save Changes</ui-button>
      </ui-card-content>
    </ui-card>
  `
})
export class TabsDemoComponent {
  username = input<string>('johndoe');
}

interface Framework {
  value: string;
  label: string;
}

export interface Payment {
  id: string;
  amount: number;
  status: 'pending' | 'processing' | 'success' | 'failed';
  email: string;
  clientName?: string;
  role?: string;
}

export type ComponentCategory = 'Inputs' | 'Data Display' | 'Feedback' | 'Overlay' | 'Navigation' | 'Layout' | 'Charts' | 'Advanced';

export interface ComponentNavItem {
  id: string;
  name: string;
  category: ComponentCategory;
}

interface OpsTicketTimelineEvent {
  at: string;
  actor: string;
  note: string;
}

interface OpsTicket {
  id: string;
  account: string;
  service: string;
  region: 'NA' | 'EU' | 'APAC' | 'LATAM';
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  status: 'Open' | 'Investigating' | 'Mitigated' | 'Resolved';
  owner: string;
  mrr: number;
  slaMinutes: number;
  createdAt: string;
  updatedAt: string;
  summary: string;
  tags: string[];
  timeline: OpsTicketTimelineEvent[];
}

@Component({
  selector: 'app-ops-table-loader',
  standalone: true,
  imports: [CommonModule, BadgeComponent],
  template: `
    <div class="flex min-w-[260px] flex-col gap-2 rounded-md border bg-background p-4 shadow-sm">
      <div class="flex items-center justify-between">
        <p class="text-sm font-medium">Syncing incident feed</p>
        <ui-badge variant="outline">{{ trigger() }}</ui-badge>
      </div>
      <div class="h-2 overflow-hidden rounded bg-muted">
        <div class="h-full w-1/3 animate-pulse bg-primary/60"></div>
      </div>
      <p class="text-xs text-muted-foreground">Working set: {{ total() }} records</p>
    </div>
  `,
})
class OpsTableLoaderComponent {
  trigger = input<string>('initial');
  total = input(0);
}

@Component({
  selector: 'app-ops-ticket-detail',
  standalone: true,
  imports: [CommonModule, BadgeComponent],
  template: `
    @if (ticket()) {
      <div class="space-y-4 p-3">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-semibold">{{ ticket()!.id }} · {{ ticket()!.account }}</p>
            <p class="text-xs text-muted-foreground">{{ ticket()!.summary }}</p>
          </div>
          <div class="flex items-center gap-2">
            <ui-badge variant="outline">{{ ticket()!.priority }}</ui-badge>
            <ui-badge variant="secondary">{{ ticket()!.status }}</ui-badge>
          </div>
        </div>

        <div class="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          <p>Service: {{ ticket()!.service }}</p>
          <p>Owner: {{ ticket()!.owner }}</p>
          <p>SLA Remaining: {{ ticket()!.slaMinutes }} min</p>
        </div>

        <div class="space-y-2">
          <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Timeline</p>
          @for (event of ticket()!.timeline; track event.at + event.actor) {
            <div class="rounded-md border p-2">
              <div class="flex items-center justify-between gap-2">
                <p class="text-xs font-medium">{{ event.actor }}</p>
                <p class="text-[11px] text-muted-foreground">{{ event.at }}</p>
              </div>
              <p class="text-xs text-muted-foreground">{{ event.note }}</p>
            </div>
          }
        </div>
      </div>
    }
  `,
})
class OpsTicketDetailComponent {
  ticket = input<OpsTicket | undefined>(undefined);
}

@Component({
  selector: 'app-root',
  imports: [
    JsonPipe,
    TitleCasePipe,
    CommonModule,
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
    ShortcutBindingsDialogComponent,
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
    SidebarMenuButtonComponent,
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
    DataTableComponent,
    OpsTableLoaderComponent,
    OpsTicketDetailComponent,
    ChatMessageComponent,
    ChatListComponent,
    ChatInputComponent,
    SparklesButtonComponent,
    StreamingTextComponent,
    CodeBlockComponent,
    InputMaskDirective,
    ReactiveFormsModule,
    SplitButtonComponent,
    SplitButtonItemComponent,
    SplitButtonMenuComponent,
    SplitButtonPrimaryComponent,
    TextRevealComponent,
    TreeSelectComponent,
    VirtualScrollComponent,
    VirtualItemDirective,
    BentoGridComponent,
    DockComponent,
    DockItemComponent,
    DockIconComponent,
    DockLabelComponent,
    PageBuilderComponent,
    PageViewerDemoComponent,
    ...ContextMenuIntegrations
  ],

  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class AppComponent {
  themes = CODE_BLOCK_THEMES;

  selectOptions = ['Apple', 'Banana', 'Blueberry', 'Grapes', 'Pineapple'];
  radioOptions = ['Default', 'Comfortable', 'Compact'];

  private toastService = inject(ToastService);
  private shortcutBindings = inject(ShortcutBindingService);
  isDark = signal(false);

  verticalTopSize = signal(40);
  verticalBottomSize = signal(60);

  complexTabs = [
    { value: 'account', label: 'Account', content: 'Make changes to your account here. Click save when you\'re done.' },
    { value: 'password', label: 'Password', content: 'Change your password here. After saving, you\'ll be logged out.' },
    { value: 'settings', label: 'Settings', content: TabsDemoComponent, contentContext: { username: 'shadcn' } },
  ];

  simpleDropdownItems: DropdownItem[] = [
    { label: 'My Account', type: 'label' },
    { type: 'separator' },
    { label: 'Profile', shortcut: '⇧⌘P' },
    { label: 'Billing', shortcut: '⌘B' },
    { label: 'Settings', shortcut: '⌘S' },
    { label: 'Keyboard shortcuts', shortcut: '⌘K' },
    { type: 'separator' },
    { label: 'Team', type: 'label' },
    {
      label: 'Invite users', type: 'sub', children: [
        { label: 'Email', shortcut: '⌘E' },
        { label: 'Message', shortcut: '⌘M' },
        { type: 'separator' },
        {
          label: 'More', type: 'sub', children: [
            { label: 'Discord' },
            { label: 'Slack' }
          ]
        }
      ]
    },
    { type: 'separator' },
    { label: 'GitHub' },
    { label: 'Support' },
    { label: 'API' },
    { type: 'separator' },
    { label: 'Log out', shortcut: '⇧⌘Q' }
  ];

  chipListTags = signal<string[]>(['Angular', 'TypeScript', 'Signals']);
  chipListFruits = signal<string[]>([
    'Apple',
    'Banana',
    'Cherry',
    'Date',
    'Elderberry',
    'Fig',
    'Grape',
  ]);

  // Data Table Demo Data
  payments = signal<Payment[]>([]);

  // Selection State
  selection = signal<Record<string, boolean>>({});
  selectionCount = computed(() => Object.keys(this.selection()).filter(k => this.selection()[k]).length);

  paymentColumns: ColumnDef<Payment>[] = [
    { accessorKey: 'id', header: 'ID', enableSorting: true, sticky: true, width: '100px' },
    { accessorKey: 'email', header: 'Email', enableSorting: true, width: 'auto' },
    { accessorKey: 'amount', header: 'Amount', enableSorting: true, width: '150px' },
    { accessorKey: 'status', header: 'Status', enableSorting: true, width: '150px' },
    { accessorKey: 'clientName', header: 'Client Name', width: 'auto' },
    { accessorKey: 'role', header: 'Role', width: '150px' },
  ];

  resizableColumns: ColumnDef<Payment>[] = [
    { accessorKey: 'id', header: 'ID', enableSorting: true, width: '80px', minWidth: '60px' },
    { accessorKey: 'email', header: 'Email', enableSorting: true, width: '250px', minWidth: '100px' },
    { accessorKey: 'amount', header: 'Amount', enableSorting: true, width: '120px', minWidth: '80px' },
    { accessorKey: 'status', header: 'Status', enableSorting: true, width: '130px', minWidth: '80px' },
    { accessorKey: 'clientName', header: 'Client Name', width: '200px', minWidth: '100px' },
    { accessorKey: 'role', header: 'Role', width: '120px', minWidth: '80px' },
  ];

  onColumnResize(event: ColumnResizeEvent) {
    console.log('Column resized:', event);
  }

  onContextMenuAction(action: string, row: any) {
    console.log(`Context Menu Action: ${action}`, row);
    this.toastService.toast({
      title: 'Context Menu Action',
      description: `Action: ${action} on row ${row?.id}`,
      variant: 'default',
    });
  }

  onTreeContextMenu(action: string, node: any) {
    console.log(`Tree Context Menu Action: ${action}`, node);
    this.toastService.toast({
      title: 'Tree Context Menu Action',
      description: `Action: ${action} on node ${node?.label}`,
      variant: 'default',
    });
  }

  // Split Button Demo
  splitButtonItems: SplitButtonItem[] = [
    { label: 'Edit', value: 'edit', icon: '✎' },
    { label: 'Duplicate', value: 'duplicate', icon: '📄' },
    { label: 'Delete', value: 'delete', icon: '🗑️', disabled: true }, // Using unicode until icons are clearer
  ];

  onSplitPrimaryClick() {
    console.log('Primary action clicked');
    alert('Primary action triggered!');
  }

  onSplitItemClick(item: SplitButtonItem) {
    console.log('Item clicked:', item);
    alert(`Menu item clicked: ${item.label}`);
  }

  constructor() {
    this.shortcutBindings.defineShortcuts('command-dialog', COMMAND_DIALOG_SHORTCUT_DEFINITIONS);
    this.shortcutBindings.defineShortcuts('rich-text-editor', RICH_TEXT_SHORTCUT_DEFINITIONS);

    // Generate 100 mock payments
    const clientNames = ['Acme Corp', 'TechStart Inc', 'Global Solutions', 'Innovation Labs', 'Digital Ventures'];
    const roles = ['Admin', 'User', 'Manager', 'Developer', 'Designer'];

    const data: Payment[] = Array.from({ length: 100 }, (_, i) => ({
      id: `PAY-${i + 1}`,
      amount: Math.floor(Math.random() * 500) + 50,
      status: ['pending', 'processing', 'success', 'failed'][Math.floor(Math.random() * 4)] as any,
      email: `user${i + 1}@example.com`,
      clientName: clientNames[Math.floor(Math.random() * clientNames.length)],
      role: roles[Math.floor(Math.random() * roles.length)],
    }));
    this.payments.set(data);

    // Initial server load
    this.loadServerData();
    this.createOpsDataset();
    this.loadOpsData();

    // Simulate subscribers increasing
    setInterval(() => {
      this.subscribersValue.update(v => v + Math.floor(Math.random() * 3) + 1);
    }, 5000);

  }

  // Custom cells demo columns using components
  customCellsColumns: ColumnDef<Payment>[] = [
    { accessorKey: 'id', header: 'ID', enableSorting: true, width: '100px' },
    {
      accessorKey: 'email',
      header: 'Email',
      enableSorting: true,
      width: 'auto',
      enableFiltering: true,
      filterComponent: TextFilterComponent
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      enableSorting: true,
      width: '150px',
      component: AmountCellComponent,
      componentInputs: (row) => ({ amount: row.amount })
    },
    {
      accessorKey: 'status',
      header: 'Status',
      enableSorting: true,
      width: '150px',
      component: StatusCellComponent,
      componentInputs: (row) => ({ status: row.status }),
      // Custom sort function: success > processing > pending > failed
      sortFn: (a, b) => {
        const statusOrder = { success: 0, processing: 1, pending: 2, failed: 3 };
        return statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder];
      }
    },
    {
      accessorKey: 'actions',
      header: 'Actions',
      width: '200px',
      enableSorting: false,
      component: ActionsCellComponent,
      componentInputs: (row) => ({
        id: row.id,
        email: row.email
      }),
      componentOutputs: (row) => ({
        view: (data: any) => this.handlePaymentAction('View', row),
        edit: (data: any) => this.handlePaymentAction('Edit', row)
      })
    },
  ];

  handlePaymentAction(action: string, payment: Payment) {
    this.toastService.toast({
      title: `${action} Payment`,
      description: `${action} payment ${payment.id} for ${payment.email}`,
      variant: 'default'
    });
  }

  // Server-Side Demo State
  serverData = signal<Payment[]>([]);
  serverTotal = signal(0);
  serverLoading = signal(true);

  // Params
  serverSort = signal<SortState>({ column: 'email', direction: 'asc' });
  serverPagination = signal<PaginationState>({ pageIndex: 0, pageSize: 10 });
  serverFilter = signal('');

  onServerSort(sort: SortState) {
    this.serverSort.set(sort);
    this.loadServerData();
  }

  onServerPage(page: PaginationState) {
    this.serverPagination.set(page);
    this.loadServerData();
  }

  onServerFilter(filter: string) {
    this.serverFilter.set(filter);
    this.serverPagination.update(p => ({ ...p, pageIndex: 0 })); // Reset to first page
    this.loadServerData();
  }

  private loadServerData() {
    this.serverLoading.set(true);

    // Mock Server Logic
    const allData = this.payments(); // Use same mock data source
    const { pageIndex, pageSize } = this.serverPagination();
    const sort = this.serverSort();
    const filter = this.serverFilter().toLowerCase();

    of(null).pipe(delay(1000)).subscribe(() => {
      let filtered = allData;

      // 1. Filter
      if (filter) {
        filtered = filtered.filter(row =>
          Object.values(row).some(val => String(val).toLowerCase().includes(filter))
        );
      }

      // 2. Sort
      if (sort.column && sort.direction) {
        filtered = [...filtered].sort((a, b) => {
          const aVal = (a as any)[sort.column];
          const bVal = (b as any)[sort.column];
          if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
          if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
          return 0;
        });
      }

      // 3. Paginate
      const start = pageIndex * pageSize;
      const sliced = filtered.slice(start, start + pageSize);

      this.serverData.set(sliced);
      this.serverTotal.set(filtered.length);
      this.serverLoading.set(false);
    });
  }

  // Realistic operations grid demo
  opsGrid = viewChild<DataTableComponent<OpsTicket>>('opsGrid');
  opsSource = signal<OpsTicket[]>([]);
  opsData = signal<OpsTicket[]>([]);
  opsTotal = signal(0);
  opsLoading = signal(false);
  opsFilter = signal('');
  opsPagination = signal<PaginationState>({ pageIndex: 0, pageSize: 10 });
  opsSort = signal<SortState>({ column: '', direction: null });
  opsMultiSort = signal<SortState[]>([]);
  opsColumnOrder = signal<string[]>([]);
  opsColumnVisibility = signal<Record<string, boolean>>({ createdAt: false });
  opsExpandedRows = signal<Record<string, boolean>>({});
  opsSavedLayout = signal<DataTableColumnState[] | null>(null);
  opsLoadingVisibility = signal<DataTableLoadingVisibility>({
    initial: true,
    pagination: true,
    sorting: true,
    filtering: true,
  });

  opsLoaderComponent = OpsTableLoaderComponent;
  opsDetailComponent = OpsTicketDetailComponent;
  opsDetailInputs = (ticket: OpsTicket) => ({ ticket });

  opsColumns: ColumnDef<OpsTicket>[] = [
    {
      accessorKey: 'id',
      header: 'Ticket',
      pin: 'left',
      width: '130px',
      enableSorting: true,
      enableHiding: false,
      enableReordering: false,
    },
    { accessorKey: 'account', header: 'Account', width: '180px', enableSorting: true },
    { accessorKey: 'service', header: 'Service', width: '160px', enableSorting: true },
    { accessorKey: 'region', header: 'Region', width: '110px', enableSorting: true },
    {
      accessorKey: 'priority',
      header: 'Priority',
      width: '95px',
      enableSorting: true,
      sortFn: (a, b) => ({ P1: 0, P2: 1, P3: 2, P4: 3 }[a.priority] - ({ P1: 0, P2: 1, P3: 2, P4: 3 }[b.priority]))
    },
    {
      accessorKey: 'status',
      header: 'Status',
      width: '140px',
      enableSorting: true,
      sortFn: (a, b) => ({ Open: 0, Investigating: 1, Mitigated: 2, Resolved: 3 }[a.status] - ({ Open: 0, Investigating: 1, Mitigated: 2, Resolved: 3 }[b.status]))
    },
    { accessorKey: 'owner', header: 'Owner', width: '140px', enableSorting: true },
    {
      accessorKey: 'mrr',
      header: 'MRR',
      width: '120px',
      enableSorting: true,
      cell: (row) => `$${row.mrr.toLocaleString()}`,
      enableGlobalFilter: false,
    },
    { accessorKey: 'slaMinutes', header: 'SLA (min)', width: '100px', enableSorting: true },
    {
      accessorKey: 'updatedAt',
      header: 'Updated',
      width: '160px',
      enableSorting: true,
      sortFn: (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      width: '160px',
      enableSorting: true,
      sortFn: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    { accessorKey: 'summary', header: 'Summary', width: 'auto', enableSorting: false, enableGlobalFilter: false },
  ];

  onOpsFilter(filter: string) {
    this.opsFilter.set(filter);
    this.opsPagination.update((state) => ({ ...state, pageIndex: 0 }));
    this.loadOpsData();
  }

  onOpsPage(page: PaginationState) {
    this.opsPagination.set(page);
    this.loadOpsData();
  }

  onOpsSort(sort: SortState) {
    this.opsSort.set(sort);
  }

  onOpsMultiSort(sorts: SortState[]) {
    this.opsMultiSort.set(sorts);
    this.loadOpsData();
  }

  toggleOpsLoaderTrigger(trigger: keyof DataTableLoadingVisibility, enabled: boolean) {
    this.opsLoadingVisibility.update((state) => ({ ...state, [trigger]: enabled }));
  }

  refreshOpsData() {
    this.opsGrid()?.setLoadingTrigger('initial');
    this.loadOpsData();
  }

  saveOpsLayout() {
    const table = this.opsGrid();
    if (!table) return;
    this.opsSavedLayout.set(table.getColumnState());
    this.toastService.success('Layout Saved', 'Column layout state saved for this session.');
  }

  restoreOpsLayout() {
    const table = this.opsGrid();
    const layout = this.opsSavedLayout();
    if (!table || !layout) return;

    table.applyColumnState(layout);
    this.opsColumnOrder.set(table.columnOrder());
    this.opsColumnVisibility.set(table.columnVisibility());
    this.toastService.toast({ title: 'Layout Restored', description: 'Saved layout re-applied.' });
  }

  applyOpsCompactPreset() {
    const table = this.opsGrid();
    if (!table) return;

    table.applyColumnState([
      { columnKey: 'id', order: 0, visible: true, width: '120px' },
      { columnKey: 'priority', order: 1, visible: true, width: '90px' },
      { columnKey: 'status', order: 2, visible: true, width: '120px' },
      { columnKey: 'owner', order: 3, visible: true, width: '130px' },
      { columnKey: 'updatedAt', order: 4, visible: true, width: '160px' },
      { columnKey: 'summary', order: 5, visible: true },
      { columnKey: 'account', visible: false },
      { columnKey: 'service', visible: false },
      { columnKey: 'region', visible: false },
      { columnKey: 'mrr', visible: false },
      { columnKey: 'createdAt', visible: false },
      { columnKey: 'slaMinutes', visible: false },
    ]);

    this.opsColumnOrder.set(table.columnOrder());
    this.opsColumnVisibility.set(table.columnVisibility());
  }

  moveOpsPriorityToFront() {
    const table = this.opsGrid();
    if (!table) return;
    table.moveColumn('priority', 1);
    this.opsColumnOrder.set(table.columnOrder());
  }

  private loadOpsData() {
    this.opsLoading.set(true);

    const source = this.opsSource();
    const filter = this.opsFilter().toLowerCase();
    const sorts = this.opsMultiSort().length > 0 ? this.opsMultiSort() : (this.opsSort().direction ? [this.opsSort()] : []);
    const { pageIndex, pageSize } = this.opsPagination();

    of(null).pipe(delay(650)).subscribe(() => {
      let rows = source;

      if (filter) {
        rows = rows.filter(row =>
          [row.id, row.account, row.service, row.owner, row.status, row.summary, row.tags.join(' ')]
            .join(' ')
            .toLowerCase()
            .includes(filter)
        );
      }

      if (sorts.length > 0) {
        rows = [...rows].sort((a, b) => {
          for (const sort of sorts) {
            const key = sort.column as keyof OpsTicket;
            const direction = sort.direction === 'desc' ? -1 : 1;
            const aVal = a[key];
            const bVal = b[key];
            if (aVal === bVal) continue;
            return (aVal! > bVal! ? 1 : -1) * direction;
          }
          return 0;
        });
      }

      const total = rows.length;
      const start = pageIndex * pageSize;
      const paged = rows.slice(start, start + pageSize);

      this.opsData.set(paged);
      this.opsTotal.set(total);
      this.opsLoading.set(false);
    });
  }

  private createOpsDataset() {
    const accounts = ['Acme Retail', 'Nova Bank', 'Helios Health', 'Orbit Logistics', 'Sierra Energy'];
    const services = ['Checkout API', 'Ledger Sync', 'Claims Gateway', 'Route Optimizer', 'Billing Engine'];
    const owners = ['Elena', 'Marcus', 'Priya', 'Noah', 'Fatima', 'Jin'];
    const regions: OpsTicket['region'][] = ['NA', 'EU', 'APAC', 'LATAM'];
    const priorities: OpsTicket['priority'][] = ['P1', 'P2', 'P3', 'P4'];
    const statuses: OpsTicket['status'][] = ['Open', 'Investigating', 'Mitigated', 'Resolved'];

    const data: OpsTicket[] = Array.from({ length: 240 }, (_, i) => {
      const created = new Date(Date.now() - (i + 1) * 1000 * 60 * 60 * 6);
      const updated = new Date(created.getTime() + (Math.floor(Math.random() * 18) + 1) * 1000 * 60 * 30);
      const priority = priorities[Math.floor(Math.random() * priorities.length)];
      const account = accounts[Math.floor(Math.random() * accounts.length)];
      const service = services[Math.floor(Math.random() * services.length)];
      const owner = owners[Math.floor(Math.random() * owners.length)];
      const region = regions[Math.floor(Math.random() * regions.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      return {
        id: `INC-${(1000 + i).toString()}`,
        account,
        service,
        region,
        priority,
        status,
        owner,
        mrr: 12000 + Math.floor(Math.random() * 185000),
        slaMinutes: 45 + Math.floor(Math.random() * 720),
        createdAt: created.toISOString(),
        updatedAt: updated.toISOString(),
        summary: `${service} latency spike detected for ${account} (${region})`,
        tags: [priority, service.split(' ')[0], region],
        timeline: [
          { at: created.toLocaleString(), actor: owner, note: 'Ticket opened and triage started.' },
          { at: new Date(created.getTime() + 1000 * 60 * 45).toLocaleString(), actor: 'AutoMonitor', note: 'Threshold alert correlated with error budget burn.' },
          { at: updated.toLocaleString(), actor: owner, note: 'Latest remediation update posted.' },
        ],
      };
    });

    this.opsSource.set(data);
  }

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
  showShortcutBindingsDialog = signal(false);
  sidebarCollapseMode = signal<'icon' | 'hidden'>('icon');

  // Chat Demo
  chatMessages = signal<{ role: 'user' | 'assistant', content: string }[]>([
    { role: 'assistant', content: 'Hello! How can I help you today?' }
  ]);

  onChatSend(message: string) {
    this.chatMessages.update(msgs => [...msgs, { role: 'user', content: message }]);
    setTimeout(() => {
      const response = 'I am a simulated AI response. I am streaming this text to demonstrate the real-time capabilities.';

      // Add empty message
      this.chatMessages.update(msgs => [...msgs, { role: 'assistant', content: '' }]);

      let i = 0;
      const interval = setInterval(() => {
        if (i < response.length) {
          this.chatMessages.update(msgs => {
            const newMsgs = [...msgs];
            const lastMsg = newMsgs[newMsgs.length - 1];
            if (lastMsg.role === 'assistant') {
              newMsgs[newMsgs.length - 1] = { ...lastMsg, content: lastMsg.content + response[i] };
            }
            return newMsgs;
          });
          i++;
        } else {
          clearInterval(interval);
        }
      }, 30);
    }, 1000);
  }

  // Form Demo
  demoForm = new FormGroup({
    username: new FormControl('', [Validators.required, Validators.minLength(2)]),
    email: new FormControl('', [Validators.required, Validators.email]),
  });

  onFormSubmit() {
    if (this.demoForm.valid) {
      this.toastService.success('Form Submitted', JSON.stringify(this.demoForm.value));
    } else {
      this.demoForm.markAllAsTouched();
    }
  }

  // Rich Text Editor demo data
  richTextContent = '';
  richTextHtml = '';
  richTextShowHistoryButton = signal(true);
  sampleMentions: MentionItem[] = [
    { id: '1', value: 'john-doe', label: 'John Doe', description: 'john.doe@example.com' },
    { id: '2', value: 'jane.smith', label: 'Jane Smith', description: 'jane.smith@example.com' },
    { id: '3', value: 'team_ops', label: 'Team Ops', description: 'ops@example.com' },
  ];
  sampleTags: TagItem[] = [
    { id: '1', value: 'angular.ui', label: 'Angular UI', color: '#dd0031' },
    { id: '2', value: 'typescript-5', label: 'TypeScript 5', color: '#3178c6' },
    { id: '3', value: 'release_2026', label: 'Release 2026', color: '#06b6d4' },
  ];

  codeBlockCSharp = `using System;

namespace DemoApp {
    [Serializable]
    public class Person {
        public string Name { get; set; }
        
        public void SayHello() {
            Console.WriteLine("Hello from C#!");
        }
    }
}`;

  codeBlockYaml = `name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run scripts
        run: echo "Hello world"
        env:
          DEBUG: true`;

  codeBlockSample = `const greeting = 'Hello, World!';
console.log(greeting);`;

  codeBlockJava = `public class HelloWorld {
    @Override
    public static void main(String[] args) {
        // Print "Hello" to the console
        System.out.println("Hello, Java!");
    }
}`;

  codeBlockHtml = `<div class="container">
    <!-- Main Header -->
    <h1 id="title">Welcome</h1>
    <p data-info="intro">This is a demo.</p>
</div>`;

  codeBlockCss = `/* Main Container Style */
.container {
    background-color: #f0f0f0;
    margin: 20px;
    padding: 10px;
    border-radius: 8px;
}`;

  codeBlockJson = `{
    "name": "shadcn-angular",
    "version": "1.0.0",
    "features": ["highlighting", "components"],
    "active": true
}`;

  codeBlockBash = `# Install dependencies
npm install

# Build the project
ng build --prod`;

  // Custom Theme Demo
  draculaTheme = {
    keyword: 'text-pink-500 font-bold',
    string: 'text-yellow-300',
    comment: 'text-purple-400',
    function: 'text-green-400',
    number: 'text-orange-300',
    decorator: 'text-green-300',
    tag: 'text-pink-500',
    attr: 'text-green-300 italic'
  };

  // Custom Language Demo (SQL)
  sqlPatterns = {
    sql: [
      { type: 'keyword', regex: /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|JOIN|AND|OR|ON|AS|GROUP|BY|ORDER|LIMIT|create|table|int|varchar|primary|key)\b/i },
      { type: 'string', regex: /'(?:[^'\\]|\\.)*'/ },
      { type: 'number', regex: /\b\d+\b/ },
      { type: 'comment', regex: /--.*/ }
    ]
  };

  codeBlockSql = `SELECT id, name, email
FROM users
WHERE status = 'active'
ORDER BY created_at DESC;`;

  onKeydown(e: KeyboardEvent) {
    this.shortcutBindings.dispatch(e);
  }

  activeComponent = signal('introduction');

  componentLinks = [
    { id: 'emoji-picker', name: 'Emoji Picker', category: 'Advanced', icon: '😀' },
    { id: 'rich-text-editor', name: 'Rich Text Editor', category: 'Advanced', icon: '📝' },
    { id: 'autocomplete', name: 'Autocomplete', category: 'Inputs', icon: '🔍' },
    { id: 'timeline', name: 'Timeline', category: 'Data Display', icon: '📅' },
    { id: 'tree-view', name: 'Tree View', category: 'Data Display', icon: '🌳' },
    { id: 'rating', name: 'Rating', category: 'Inputs', icon: '⭐' },
    { id: 'stepper', name: 'Stepper', category: 'Navigation', icon: '👣' },
    { id: 'file-upload', name: 'File Upload', category: 'Advanced', icon: '📤' },
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
  ];

  categories = computed(() => {
    const categories = new Set(this.componentLinks.map(l => l.category));
    return Array.from(categories).sort();
  });

  getCategoryIcon(category: string): string {
    switch (category) {
      case 'Data Display':
        return 'M3 3v18h18V3H3zm8 16H5v-6h6v6zm0-8H5V5h6v6zm8 8h-6v-6h6v6zm0-8h-6V5h6v6z'; // LayoutGrid
      case 'Feedback':
        return 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'; // MessageSquare
      case 'Overlay':
        return 'M2 12L12 17L22 12L12 7L2 12ZM2 17L12 22L22 17'; // Layers (simplified)
      case 'Inputs':
        return 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8'; // Inbox/Input
      case 'Advanced':
        return 'm12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z'; // Sparkles
      case 'Layout':
        return 'M3 3h18v18H3zM3 9h18M9 21V9'; // LayoutDashboard-ish
      case 'Navigation':
        return 'M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0 m9-2 2 2-2 2-2-2z'; // Compass-ish
      default:
        return 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'; // File
    }
  }

  navTo(id: string) {
    this.activeComponent.set(id);
    this.showCommandDialog.set(false);
  }

  getLinksByCategory(category: string) {
    return this.componentLinks
      .filter(l => l.category === category)
      .sort((a, b) => a.name.localeCompare(b.name));
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

  // Tree Select Demo
  treeSelectNodes = signal<TreeNode[]>([
    {
      key: 'documents',
      label: 'Documents',
      icon: '📁',
      children: [
        {
          key: 'work', label: 'Work', icon: '📂', children: [
            { key: 'report', label: 'Report.docx', icon: '📄' },
            { key: 'expenses', label: 'Expenses.xlsx', icon: '📊' }
          ]
        },
        {
          key: 'personal', label: 'Personal', icon: '📂', children: [
            { key: 'resume', label: 'Resume.pdf', icon: '📄' }
          ]
        }
      ]
    },
    {
      key: 'images',
      label: 'Images',
      icon: '🖼️',
      children: [
        {
          key: 'vacation', label: 'Vacation', children: [
            { key: 'beach', label: 'Beach.jpg', icon: '📷' },
            { key: 'mountains', label: 'Mountains.jpg', icon: '📷' }
          ]
        }
      ]
    }
  ]);
  treeSelectValue = signal<string | null>(null);

  // Dock Demo
  dockMagnification = signal(60);
  dockDistance = signal(100);
  dockItems = signal([
    { label: 'Home', icon: '🏠', active: true },
    { label: 'Profile', icon: '👤', active: false },
    { label: 'Settings', icon: '⚙️', active: false },
    { label: 'Messages', icon: '✉️', active: false },
    { label: 'Calendar', icon: '📅', active: false },
  ]);

  toggleDockItem(index: number) {
    this.dockItems.update(items => items.map((item, i) =>
      i === index ? { ...item, active: !item.active } : item
    ));
  }

  // Bento Grid / Dashboard
  isEditMode = signal(false);
  widgets = signal<{ id: string, title: string, component: any, icon: string }[]>([
    { id: 'metric', title: 'Metric Card', component: MetricWidgetComponent, icon: '📊' },
    { id: 'calendar', title: 'Calendar', component: CalendarWidgetComponent, icon: '📅' },
    { id: 'team', title: 'Team Members', component: TeamWidgetComponent, icon: '👥' },
    { id: 'activity', title: 'Activity Feed', component: ActivityWidgetComponent, icon: '🔔' },
  ]);

  dashboardItems = signal<DashboardItem[]>([
    {
      id: '1', x: 1, y: 1, cols: 4, rows: 2,
      content: MetricWidgetComponent,
      inputs: { title: 'Total Revenue', value: '$45,231.89', trend: 20.1 }
    },
    {
      id: '2', x: 5, y: 1, cols: 4, rows: 2,
      content: MetricWidgetComponent,
      inputs: { title: 'Subscriptions', value: '+2350', trend: 180.1 }
    },
    {
      id: '3', x: 9, y: 1, cols: 4, rows: 2,
      content: MetricWidgetComponent,
      inputs: { title: 'Sales', value: '+12,234', trend: 19 }
    },
    {
      id: '4', x: 1, y: 3, cols: 8, rows: 4,
      content: ActivityWidgetComponent
    },
    {
      id: '5', x: 9, y: 3, cols: 4, rows: 4,
      content: TeamWidgetComponent
    },
    {
      id: '6', x: 1, y: 7, cols: 4, rows: 4,
      content: CalendarWidgetComponent
    },
    {
      id: '7', x: 5, y: 7, cols: 4, rows: 3,
      content: ActionWidgetComponent,
      outputs: {
        action: (type: string) => this.onWidgetAction(type)
      }
    }
  ]);

  onWidgetAction(type: string) {
    this.toastService.success('Widget Action', `Action triggered: ${type}`);
  }



  // ... (keep existing imports)

  // Inside AppComponent class:

  // Page Builder Demo
  pageBuilderComponents = signal<ComponentMeta[]>([
    // LAYOUT
    {
      id: 'card',
      name: 'Card',
      category: 'Layout',
      component: CardComponent,
      icon: 'layout',
      defaultInputs: { title: 'New Card', description: 'Card description goes here.' },
    },
    {
      id: 'tabs',
      name: 'Tabs',
      category: 'Layout',
      component: TabsComponent,
      icon: 'panels-top-left',
      defaultInputs: {},
    },
    {
      id: 'accordion',
      name: 'Accordion',
      category: 'Layout',
      component: AccordionComponent,
      icon: 'list-collapse',
      defaultInputs: {},
    },
    {
      id: 'separator',
      name: 'Separator',
      category: 'Layout',
      component: SeparatorComponent,
      icon: 'minus',
      defaultInputs: {},
    },

    // INPUTS
    {
      id: 'button',
      name: 'Button',
      category: 'Inputs',
      component: ButtonComponent,
      icon: 'box-select',
      defaultInputs: { variant: 'default', size: 'default', label: 'Click Me' },
      inputs: [
        { name: 'variant', type: 'select', options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] },
        { name: 'size', type: 'select', options: ['default', 'sm', 'lg', 'icon'] }
      ]
    },
    {
      id: 'input',
      name: 'Input',
      category: 'Inputs',
      component: InputComponent,
      icon: 'text-cursor',
      defaultInputs: { placeholder: 'Type something...', value: '' }
    },
    {
      id: 'textarea',
      name: 'Textarea',
      category: 'Inputs',
      component: TextareaComponent,
      icon: 'file-text',
      defaultInputs: { placeholder: 'Start typing...', value: '' }
    },
    {
      id: 'switch',
      name: 'Switch',
      category: 'Inputs',
      component: SwitchComponent,
      icon: 'toggle-right',
      defaultInputs: { checked: false, label: 'Enable setting' }
    },
    {
      id: 'checkbox',
      name: 'Checkbox',
      category: 'Inputs',
      component: CheckboxComponent,
      icon: 'check-square',
      defaultInputs: { checked: false, label: 'Accept terms' }
    },
    {
      id: 'slider',
      name: 'Slider',
      category: 'Inputs',
      component: SliderComponent,
      icon: 'sliders-horizontal',
      defaultInputs: { value: [50], min: 0, max: 100, step: 1 }
    },
    {
      id: 'radio-group',
      name: 'Radio Group',
      category: 'Inputs',
      component: RadioGroupComponent,
      icon: 'circle-dot',
      defaultInputs: { options: ['Option 1', 'Option 2', 'Option 3'] }
    },
    {
      id: 'rating',
      name: 'Rating',
      category: 'Inputs',
      component: RatingComponent,
      icon: 'star',
      defaultInputs: { value: 3 }
    },

    // DATA DISPLAY
    {
      id: 'badge',
      name: 'Badge',
      category: 'Data Display',
      component: BadgeComponent,
      icon: 'tag',
      defaultInputs: { variant: 'default', label: 'New' },
      inputs: [{ name: 'variant', type: 'select', options: ['default', 'secondary', 'destructive', 'outline'] }]
    },
    {
      id: 'avatar',
      name: 'Avatar',
      category: 'Data Display',
      component: AvatarComponent,
      icon: 'user-circle',
      defaultInputs: { src: 'https://github.com/shadcn.png' }
    },
    {
      id: 'timeline',
      name: 'Timeline',
      category: 'Data Display',
      component: TimelineComponent,
      icon: 'clock',
      defaultInputs: {}
    },
    {
      id: 'breadcrumb',
      name: 'Breadcrumb',
      category: 'Data Display',
      component: BreadcrumbComponent,
      icon: 'chevron-right',
      defaultInputs: {}
    },
    {
      id: 'code-block',
      name: 'Code Block',
      category: 'Data Display',
      component: CodeBlockComponent,
      icon: 'code',
      defaultInputs: { code: 'console.log("Hello Page Builder!");', language: 'javascript' }
    },

    // FEEDBACK
    {
      id: 'alert',
      name: 'Alert',
      category: 'Feedback',
      component: AlertComponent,
      icon: 'alert-triangle',
      defaultInputs: { variant: 'default', title: 'Attention!', description: 'Something important happened.' },
      inputs: [{ name: 'variant', type: 'select', options: ['default', 'destructive'] }]
    },
    {
      id: 'progress',
      name: 'Progress',
      category: 'Feedback',
      component: ProgressComponent,
      icon: 'loader',
      defaultInputs: { value: 66 }
    },
    {
      id: 'spinner',
      name: 'Spinner',
      category: 'Feedback',
      component: SpinnerComponent,
      icon: 'refresh-cw',
      defaultInputs: { size: 'md' }
    },

    // ADVANCED
    {
      id: 'metric',
      name: 'Metric',
      category: 'Advanced',
      component: MetricWidgetComponent,
      icon: 'bar-chart-2',
      defaultInputs: { title: 'Revenue', value: '$12,842', trend: 12.5 }
    },
    {
      id: 'sparkles',
      name: 'Sparkles Button',
      category: 'Advanced',
      component: SparklesButtonComponent,
      icon: 'sparkles',
      defaultInputs: { label: 'Magic Button' }
    },
    {
      id: 'chat-list',
      name: 'Chat List',
      category: 'Advanced',
      component: ChatListComponent,
      icon: 'message-square',
      defaultInputs: {}
    },
    {
      id: 'streaming-text',
      name: 'Streaming Text',
      category: 'Advanced',
      component: StreamingTextComponent,
      icon: 'type',
      defaultInputs: { text: 'This text is appearing character by character...', speed: 50 }
    }
  ]);

  onExternalDrop(event: { widgetId: string, targetId: string | null, x?: number, y?: number }) {
    const widget = this.widgets().find(w => w.id === event.widgetId);
    if (!widget) return;

    this.dashboardItems.update(items =>
      items.map(item => {
        if (item.id === event.targetId) {
          return {
            ...item,
            content: widget.component,
            inputs: widget.id === 'metric' ? { title: 'New Metric', value: '0', trend: 0 } : {}
          };
        }
        return item;
      })
    );
    // Note: app.html for bento-grid demo might strictly look for `targetId: string` if it binds to a specific type,
    // but since we updated the handler here, it should be fine if we updated the generic correctly.
    // However, the dashboard items replacement logic is SPECIFIC to the dashboard demo (replacing content of existing item).
    // Page Builder uses a different logic (adding NEW item).
    // We are reusing `onExternalDrop`? No, PageBuilder has its OWN `onExternalDrop`.
    // The error was in `app.html` which calls `onExternalDrop` for the EXISTING BentoGrid demo.
    // So I must ensure this method signature matches what `BentoGrid` emits.
  }


  onDashboardItemsChange(items: DashboardItem[]) {
    this.dashboardItems.set(items);
  }

  toggleEditMode() {
    this.isEditMode.update(v => !v);
  }

  // Virtual Scroll Demo State
  virtualScrollRef = viewChild<VirtualScrollComponent<any>>('virtualScrollRef');
  virtualScrollItems = signal<VirtualScrollItem[]>([]);
  virtualScrollLoading = signal(false);
  virtualScrollHasMoreTop = signal(true);
  virtualScrollHasMoreBottom = signal(true);
  virtualScrollWindowStart = signal(0);
  virtualScrollWindowEnd = signal(0);
  virtualScrollVisibleCount = signal(0);
  virtualScrollProgress = signal(0);
  private virtualScrollPageTop = 0;
  private virtualScrollPageBottom = 0;
  private readonly ITEMS_PER_PAGE = 50;

  private generateVirtualScrollItems() {
    const items = [];
    const types = ['card', 'list', 'image', 'chart'];
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

    // Heights from 50px to 2000px with weighted distribution
    const getHeight = () => {
      const rand = Math.random();
      if (rand < 0.4) return 50 + Math.floor(Math.random() * 100);      // 40% small (50-150px)
      if (rand < 0.7) return 150 + Math.floor(Math.random() * 200);     // 30% medium (150-350px)
      if (rand < 0.9) return 350 + Math.floor(Math.random() * 400);     // 20% large (350-750px)
      return 750 + Math.floor(Math.random() * 1250);                     // 10% extra large (750-2000px)
    };

    for (let i = 0; i < this.ITEMS_PER_PAGE * 2; i++) {
      const height = getHeight();
      const type = types[Math.floor(Math.random() * types.length)];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const id = i + 1;

      items.push({
        id,
        title: `Complex Item #${id}`,
        description: `This is a ${type} item with ${height}px height. It demonstrates the virtual scroll's ability to handle dramatically different item sizes efficiently.`,
        height,
        type,
        color,
        tags: type === 'card' ? ['Tag A', 'Tag B', 'Tag C'] : [],
        subItems: type === 'list' ? [
          { id: 1, name: 'Sub-item One' },
          { id: 2, name: 'Sub-item Two' },
          { id: 3, name: 'Sub-item Three' },
          { id: 4, name: 'Sub-item Four' },
        ] : [],
        imageSize: type === 'image' ? '1920x1080' : '',
        chartData: type === 'chart' ? [
          { month: 'Jan', value: 30 + Math.random() * 70 },
          { month: 'Feb', value: 30 + Math.random() * 70 },
          { month: 'Mar', value: 30 + Math.random() * 70 },
          { month: 'Apr', value: 30 + Math.random() * 70 },
          { month: 'May', value: 30 + Math.random() * 70 },
          { month: 'Jun', value: 30 + Math.random() * 70 },
        ] : [],
        expandedContent: height > 500 ?
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. '.repeat(5) : '',
      });
    }

    this.virtualScrollItems.set(items);
    this.virtualScrollPageBottom = 2;
  }

  onVirtualScrollEnd(direction: 'top' | 'bottom') {
    if (direction === 'bottom') {
      this.loadMoreBottom();
    } else {
      this.loadMoreTop();
    }
  }

  loadMoreBottom() {
    if (this.virtualScrollLoading() || !this.virtualScrollHasMoreBottom()) return;

    this.virtualScrollLoading.set(true);

    // Simulate API call
    setTimeout(() => {
      const currentItems = this.virtualScrollItems();
      const newItems = [];
      const types = ['card', 'list', 'image', 'chart'];
      const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

      const getHeight = () => {
        const rand = Math.random();
        if (rand < 0.4) return 50 + Math.floor(Math.random() * 100);
        if (rand < 0.7) return 150 + Math.floor(Math.random() * 200);
        if (rand < 0.9) return 350 + Math.floor(Math.random() * 400);
        return 750 + Math.floor(Math.random() * 1250);
      };

      const startId = currentItems.length + 1;

      for (let i = 0; i < this.ITEMS_PER_PAGE; i++) {
        const height = getHeight();
        const type = types[Math.floor(Math.random() * types.length)];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const id = startId + i;

        newItems.push({
          id,
          title: `Complex Item #${id}`,
          description: `This is a ${type} item with ${height}px height. It demonstrates the virtual scroll's ability to handle dramatically different item sizes efficiently.`,
          height,
          type,
          color,
          tags: type === 'card' ? ['Tag A', 'Tag B', 'Tag C'] : [],
          subItems: type === 'list' ? [
            { id: 1, name: 'Sub-item One' },
            { id: 2, name: 'Sub-item Two' },
            { id: 3, name: 'Sub-item Three' },
            { id: 4, name: 'Sub-item Four' },
          ] : [],
          imageSize: type === 'image' ? '1920x1080' : '',
          chartData: type === 'chart' ? [
            { month: 'Jan', value: 30 + Math.random() * 70 },
            { month: 'Feb', value: 30 + Math.random() * 70 },
            { month: 'Mar', value: 30 + Math.random() * 70 },
            { month: 'Apr', value: 30 + Math.random() * 70 },
            { month: 'May', value: 30 + Math.random() * 70 },
            { month: 'Jun', value: 30 + Math.random() * 70 },
          ] : [],
          expandedContent: height > 500 ?
            'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20) : '',
        });
      }

      this.virtualScrollItems.set([...currentItems, ...newItems]);
      this.virtualScrollPageBottom++;
      this.virtualScrollLoading.set(false);

      // Stop after 10 pages
      if (this.virtualScrollPageBottom >= 10) {
        this.virtualScrollHasMoreBottom.set(false);
      }
    }, 500);
  }

  loadMoreTop() {
    if (this.virtualScrollLoading() || !this.virtualScrollHasMoreTop()) return;

    this.virtualScrollLoading.set(true);

    setTimeout(() => {
      const currentItems = this.virtualScrollItems();
      const newItems = [];
      const types = ['card', 'list', 'image', 'chart'];
      const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

      const getHeight = () => {
        const rand = Math.random();
        if (rand < 0.4) return 50 + Math.floor(Math.random() * 100);
        if (rand < 0.7) return 150 + Math.floor(Math.random() * 200);
        if (rand < 0.9) return 350 + Math.floor(Math.random() * 400);
        return 750 + Math.floor(Math.random() * 1250);
      };

      for (let i = 0; i < this.ITEMS_PER_PAGE; i++) {
        const height = getHeight();
        const type = types[Math.floor(Math.random() * types.length)];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const id = -(this.virtualScrollPageTop * this.ITEMS_PER_PAGE + i + 1);

        newItems.unshift({
          id,
          title: `Complex Item #${id}`,
          description: `This is a ${type} item with ${height}px height.`,
          height,
          type,
          color,
          tags: type === 'card' ? ['Tag A', 'Tag B', 'Tag C'] : [],
          subItems: type === 'list' ? [
            { id: 1, name: 'Sub-item One' },
            { id: 2, name: 'Sub-item Two' },
          ] : [],
          imageSize: type === 'image' ? '1920x1080' : '',
          chartData: type === 'chart' ? [
            { month: 'Jan', value: 30 + Math.random() * 70 },
            { month: 'Feb', value: 30 + Math.random() * 70 },
          ] : [],
          expandedContent: height > 500 ? 'Expanded content...' : '',
        });
      }

      this.virtualScrollItems.set([...newItems, ...currentItems]);
      this.virtualScrollPageTop++;
      this.virtualScrollLoading.set(false);

      if (this.virtualScrollPageTop >= 5) {
        this.virtualScrollHasMoreTop.set(false);
      }
    }, 500);
  }

  onVirtualScrollStateChange(state: VirtualScrollState) {
    this.virtualScrollWindowStart.set(state.windowStart);
    this.virtualScrollWindowEnd.set(state.windowEnd);
    this.virtualScrollVisibleCount.set(state.windowSize);
    this.virtualScrollProgress.set(state.scrollProgress);
  }

  scrollVirtualToTop() {
    this.virtualScrollRef()?.scrollToTop();
  }

  scrollVirtualToBottom() {
    this.virtualScrollRef()?.scrollToBottom();
  }
}
