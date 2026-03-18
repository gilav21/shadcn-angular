import { Component, ChangeDetectionStrategy, signal, inject, computed, input, OnDestroy, output } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
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
  ColumnDef,
} from '../../../packages/components/ui';

export type ComponentCategory = 'Inputs' | 'Data Display' | 'Feedback' | 'Overlay' | 'Navigation' | 'Layout' | 'Charts' | 'Advanced';

export interface ComponentNavItem {
  readonly id: string;
  readonly name: string;
  readonly category: ComponentCategory;
  readonly icon: string;
}

// --- Virtual Scroll Demo Cell Components ---

@Component({
  selector: 'app-vdemo-status-cell',
  template: `
    <div class="flex items-center gap-2">
      <div class="h-2 w-2 rounded-full"
           [class.bg-green-500]="status() === 'active'"
           [class.bg-red-500]="status() === 'inactive'"
           [class.bg-yellow-500]="status() === 'pending'">
      </div>
      <span class="text-xs">{{ status() }}</span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class VDemoStatusCellComponent {
  readonly status = input<string>('active');
}

@Component({
  selector: 'app-vdemo-toggle-cell',
  template: `
    <label class="flex items-center gap-1 cursor-pointer">
      <input type="checkbox" [checked]="enabled()" (change)="onToggle()" class="h-3 w-3" />
      <span class="text-xs">{{ enabled() ? 'On' : 'Off' }}</span>
    </label>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class VDemoToggleCellComponent {
  readonly enabled = input(false);
  readonly toggled = output<boolean>();

  onToggle() {
    this.toggled.emit(!this.enabled());
  }
}

type MetricFormat = 'currency' | 'percent' | 'number';

@Component({
  selector: 'app-vdemo-rich-metric-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-0.5 p-1 min-w-[130px]">
      <!-- Row 1: label + delta badge -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1">
          <div class="h-1.5 w-1.5 rounded-full" [class]="statusDotClass()"></div>
          <span class="text-xs font-medium truncate">{{ label() }}</span>
        </div>
        <div class="flex items-center gap-0.5 rounded px-1 py-0.5" [class]="deltaBadgeBg()">
          <svg class="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none">
            @if (delta() >= 0) {
              <path d="M6 2L10 8H2L6 2Z" [attr.fill]="trendColor()" />
            } @else {
              <path d="M6 10L2 4H10L6 10Z" [attr.fill]="trendColor()" />
            }
          </svg>
          <span class="text-[9px] font-semibold" [class]="deltaClass()">
            {{ deltaPrefix() }}{{ delta() }}%
          </span>
        </div>
      </div>

      <!-- Row 2: value + target -->
      <div class="flex items-baseline justify-between">
        <span class="text-sm font-bold">{{ formattedValue() }}</span>
        <span class="text-[9px] text-muted-foreground">/ {{ formattedTarget() }}</span>
      </div>

      <!-- Row 3: sparkline with gradient -->
      <svg class="w-full h-4" [attr.viewBox]="sparklineViewBox" preserveAspectRatio="none">
        <defs>
          <linearGradient [attr.id]="gradientId()" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" [attr.stop-color]="trendColor()" stop-opacity="0.4" />
            <stop offset="50%" [attr.stop-color]="trendColor()" stop-opacity="0.1" />
            <stop offset="100%" [attr.stop-color]="trendColor()" stop-opacity="0" />
          </linearGradient>
        </defs>
        <polygon [attr.points]="areaPoints()" [attr.fill]="'url(#' + gradientId() + ')'" />
        <polyline [attr.points]="linePoints()" fill="none" [attr.stroke]="trendColor()" stroke-width="1.5" stroke-linejoin="round" />
        @for (pt of sparkDots(); track $index) {
          <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="1.5" [attr.fill]="trendColor()" />
        }
      </svg>

      <!-- Row 4: mini bar chart (8 bars) -->
      <svg class="w-full h-3" viewBox="0 0 64 12" preserveAspectRatio="none">
        @for (bar of barChartData(); track $index) {
          <rect [attr.x]="bar.x" [attr.y]="bar.y" [attr.width]="bar.w" [attr.height]="bar.h"
                [attr.fill]="bar.color" rx="1" />
        }
      </svg>

      <!-- Row 5: progress bar -->
      <div class="w-full bg-muted rounded-full h-1.5">
        <div class="h-1.5 rounded-full" [class]="progressBarClass()" [style.width.%]="progressPercent()"></div>
      </div>

      <!-- Row 6: secondary metrics row -->
      <div class="flex justify-between gap-1">
        <div class="flex flex-col">
          <span class="text-[8px] text-muted-foreground uppercase tracking-wider">Avg</span>
          <span class="text-[10px] font-medium">{{ formattedAvg() }}</span>
        </div>
        <div class="flex flex-col items-center">
          <span class="text-[8px] text-muted-foreground uppercase tracking-wider">Min</span>
          <span class="text-[10px] font-medium">{{ formattedMin() }}</span>
        </div>
        <div class="flex flex-col items-end">
          <span class="text-[8px] text-muted-foreground uppercase tracking-wider">Max</span>
          <span class="text-[10px] font-medium">{{ formattedMax() }}</span>
        </div>
      </div>

      <!-- Row 7: secondary sparkline (inverted) -->
      <svg class="w-full h-3" [attr.viewBox]="sparklineViewBox" preserveAspectRatio="none">
        <defs>
          <linearGradient [attr.id]="gradient2Id()" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" [attr.stop-color]="secondaryColor()" stop-opacity="0.3" />
            <stop offset="100%" [attr.stop-color]="secondaryColor()" stop-opacity="0" />
          </linearGradient>
        </defs>
        <polygon [attr.points]="area2Points()" [attr.fill]="'url(#' + gradient2Id() + ')'" />
        <polyline [attr.points]="line2Points()" fill="none" [attr.stroke]="secondaryColor()" stroke-width="1" stroke-dasharray="2 1" />
      </svg>

      <!-- Row 8: period labels -->
      <div class="flex justify-between text-[8px] text-muted-foreground">
        <span>7d ago</span>
        <span>3d ago</span>
        <span>Now</span>
      </div>
    </div>
  `,
})
class VDemoRichMetricCellComponent {
  readonly value = input(0);
  readonly delta = input(0);
  readonly target = input(100);
  readonly sparklineData = input<number[]>([]);
  readonly label = input('Metric');
  readonly format = input<MetricFormat>('number');

  private static nextId = 0;
  private readonly instanceId = VDemoRichMetricCellComponent.nextId++;

  readonly gradientId = computed(() => `sg${this.instanceId}`);
  readonly gradient2Id = computed(() => `sg2${this.instanceId}`);
  readonly sparklineViewBox = '0 0 60 16';

  readonly formattedValue = computed(() => this.formatNumber(this.value()));
  readonly formattedTarget = computed(() => this.formatNumber(this.target()));
  readonly deltaPrefix = computed(() => (this.delta() >= 0 ? '+' : ''));
  readonly trendColor = computed(() => (this.delta() >= 0 ? '#22c55e' : '#ef4444'));
  readonly secondaryColor = computed(() => (this.delta() >= 0 ? '#3b82f6' : '#f59e0b'));

  readonly deltaClass = computed(() =>
    this.delta() >= 0 ? 'text-green-700' : 'text-red-700'
  );

  readonly deltaBadgeBg = computed(() =>
    this.delta() >= 0 ? 'bg-green-100' : 'bg-red-100'
  );

  readonly statusDotClass = computed(() =>
    this.delta() >= 0 ? 'bg-green-500' : 'bg-red-500'
  );

  readonly progressPercent = computed(() => {
    const t = this.target();
    if (t <= 0) return 0;
    return Math.min(100, Math.round((this.value() / t) * 100));
  });

  readonly progressBarClass = computed(() =>
    this.delta() >= 0 ? 'bg-green-500' : 'bg-red-500'
  );

  readonly formattedAvg = computed(() => {
    const data = this.sparklineData();
    if (data.length === 0) return '0';
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    return this.formatNumber(Math.round(avg));
  });

  readonly formattedMin = computed(() => {
    const data = this.sparklineData();
    return data.length === 0 ? '0' : this.formatNumber(Math.min(...data));
  });

  readonly formattedMax = computed(() => {
    const data = this.sparklineData();
    return data.length === 0 ? '0' : this.formatNumber(Math.max(...data));
  });

  readonly sparkDots = computed(() => {
    const data = this.sparklineData();
    if (data.length === 0) return [];
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const step = 60 / (data.length - 1 || 1);
    return data.map((v, i) => ({
      x: i * step,
      y: 14 - ((v - min) / range) * 12,
    }));
  });

  readonly linePoints = computed(() =>
    this.sparkDots().map(p => `${p.x},${p.y}`).join(' ')
  );

  readonly areaPoints = computed(() => {
    const pts = this.sparkDots();
    if (pts.length === 0) return '';
    return `0,14 ${pts.map(p => `${p.x},${p.y}`).join(' ')} 60,14`;
  });

  readonly barChartData = computed(() => {
    const data = this.sparklineData();
    if (data.length === 0) return [];
    const max = Math.max(...data, 1);
    const barW = 6;
    const gap = 2;
    const positive = this.delta() >= 0;
    return data.map((v, i) => {
      const h = Math.max(1, (v / max) * 11);
      return {
        x: i * (barW + gap),
        y: 12 - h,
        w: barW,
        h,
        color: positive
          ? (i === data.length - 1 ? '#22c55e' : '#86efac')
          : (i === data.length - 1 ? '#ef4444' : '#fca5a5'),
      };
    });
  });

  readonly line2Points = computed(() => {
    const data = this.sparklineData();
    if (data.length === 0) return '';
    const reversed = [...data].reverse();
    const max = Math.max(...reversed);
    const min = Math.min(...reversed);
    const range = max - min || 1;
    const step = 60 / (reversed.length - 1 || 1);
    return reversed
      .map((v, i) => `${i * step},${14 - ((v - min) / range) * 12}`)
      .join(' ');
  });

  readonly area2Points = computed(() => {
    const lp = this.line2Points();
    if (lp === '') return '';
    return `0,14 ${lp} 60,14`;
  });

  private formatNumber(n: number): string {
    const fmt = this.format();
    if (fmt === 'currency') return `$${n.toLocaleString()}`;
    if (fmt === 'percent') return `${n}%`;
    return n.toLocaleString();
  }
}

@Component({
  selector: 'app-fps-meter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-3 font-mono text-xs">
      <span class="flex items-center gap-1">
        <span class="font-medium">FPS:</span>
        <span [class]="fpsClass()">{{ fps() }}</span>
      </span>
      <span class="text-muted-foreground">|</span>
      <span class="flex items-center gap-1">
        <span class="font-medium">Frame:</span>
        <span>{{ frameTime() }}ms</span>
      </span>
    </div>
  `,
})
class FpsMeterComponent implements OnDestroy {
  readonly fps = signal(60);
  readonly frameTime = signal(0);

  private rafId = 0;
  private frames = 0;
  private lastTime = performance.now();
  private lastFrameTime = performance.now();

  readonly fpsClass = computed(() => {
    const f = this.fps();
    if (f >= 50) return 'text-green-500 font-bold';
    if (f >= 30) return 'text-yellow-500 font-bold';
    return 'text-red-500 font-bold';
  });

  constructor() {
    this.rafId = requestAnimationFrame((t) => this.tick(t));
  }

  private tick(now: number): void {
    this.frameTime.set(Math.round(now - this.lastFrameTime));
    this.lastFrameTime = now;
    this.frames++;
    if (now - this.lastTime >= 1000) {
      this.fps.set(this.frames);
      this.frames = 0;
      this.lastTime = now;
    }
    this.rafId = requestAnimationFrame((t) => this.tick(t));
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
  }
}

@Component({
  selector: 'app-vdemo-variable-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-1 text-xs leading-relaxed" [style.min-height.px]="minHeight()">
      {{ content() }}
    </div>
  `,
})
class VDemoVariableContentCellComponent {
  readonly content = input('');
  readonly minHeight = input(30);
}

interface VDemoRow {
  id: number;
  name: string;
  [key: string]: unknown;
}

const METRIC_LABELS = ['Revenue', 'Users', 'Latency', 'Errors', 'Throughput', 'Conversion', 'Retention', 'Churn'];
const METRIC_FORMATS: MetricFormat[] = ['currency', 'percent', 'number'];

function generateVDemoData(rowCount: number, colCount: number): VDemoRow[] {
  const statuses = ['active', 'inactive', 'pending'];
  const data: VDemoRow[] = [];
  for (let r = 0; r < rowCount; r++) {
    const row: VDemoRow = { id: r + 1, name: `Row ${r + 1}` };
    for (let c = 0; c < colCount; c++) {
      row[`col${c}`] = `R${r + 1}C${c}`;
    }
    row['status'] = statuses[r % 3];
    row['enabled'] = r % 2 === 0;
    row['metricValue'] = Math.round(Math.random() * 10000);
    row['metricDelta'] = Math.round((Math.random() * 40 - 20) * 10) / 10;
    row['metricTarget'] = Math.round(Math.random() * 12000);
    row['sparklineData'] = Array.from({ length: 7 }, () => Math.round(Math.random() * 100));
    row['metricLabel'] = METRIC_LABELS[(r + Math.floor(r / 8)) % METRIC_LABELS.length];
    row['metricFormat'] = METRIC_FORMATS[r % 3];
    const rowH = 40 + Math.floor(Math.random() * 960);
    row['rowHeight'] = rowH;
    const lineCount = Math.max(1, Math.floor(rowH / 20));
    row['notes'] = Array.from({ length: lineCount }, (_, i) =>
      `Line ${i + 1}: Sample note text for row ${r + 1} with some content to fill the variable height.`
    ).join('\n');
    data.push(row);
  }
  return data;
}

function generateVDemoColumns(colCount: number, heavyMode: boolean, variableRows: boolean): ColumnDef<VDemoRow>[] {
  const cols: ColumnDef<VDemoRow>[] = [
    { accessorKey: 'id', header: 'ID', width: '80px', sticky: true },
    { accessorKey: 'name', header: 'Name', width: '150px', sticky: true },
  ];

  if (variableRows) {
    cols.push({
      accessorKey: 'notes',
      header: 'Notes',
      width: '250px',
      sticky: true,
      component: VDemoVariableContentCellComponent,
      componentInputs: (row: VDemoRow) => ({
        content: row['notes'] as string,
        minHeight: row['rowHeight'] as number,
      }),
    });
  }

  for (let c = 0; c < colCount; c++) {
    if (c < 50) {
      if (heavyMode) {
        cols.push({
          accessorKey: `col${c}`,
          header: `Metric ${c}`,
          width: '140px',
          component: VDemoRichMetricCellComponent,
          componentInputs: (row: VDemoRow) => ({
            value: row['metricValue'] as number,
            delta: row['metricDelta'] as number,
            target: row['metricTarget'] as number,
            sparklineData: row['sparklineData'] as number[],
            label: row['metricLabel'] as string,
            format: row['metricFormat'] as MetricFormat,
          }),
        });
      } else if (c < 25) {
        cols.push({
          accessorKey: `col${c}`,
          header: `Status ${c}`,
          width: '120px',
          component: VDemoStatusCellComponent,
          componentInputs: (row: VDemoRow) => ({ status: row['status'] }),
        });
      } else {
        cols.push({
          accessorKey: `col${c}`,
          header: `Toggle ${c}`,
          width: '100px',
          component: VDemoToggleCellComponent,
          componentInputs: (row: VDemoRow) => ({ enabled: row['enabled'] }),
          componentOutputs: (row: VDemoRow) => ({
            toggled: (val: boolean) => { row['enabled'] = val; },
          }),
        });
      }
    } else if (c < 55) {
      cols.push({
        accessorKey: `col${c}`,
        header: `Img ${c}`,
        width: '80px',
        cell: () => '🖼️',
      });
    } else {
      cols.push({
        accessorKey: `col${c}`,
        header: `Col ${c}`,
        width: `${80 + (c % 5) * 20}px`,
        cell: (row: VDemoRow) => String(row[`col${c}`] ?? ''),
      });
    }
  }

  return cols;
}

const VDEMO_DATA = generateVDemoData(10000, 100);

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

    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    ).subscribe(e => {
      const path = e.urlAfterRedirects.replace(/^\/+/, '');
      const link = this.componentLinks.find(l => l.id === path);
      document.title = link ? `${link.name} - shadcn-angular` : 'shadcn-angular';
    });
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
    this.showCommandDialog.set(false);
    this.router.navigate([id === 'introduction' ? '/' : `/${id}`]);
  }

  getLinksByCategory(category: string) {
    return this.linksByCategory().get(category) ?? [];
  }
}
