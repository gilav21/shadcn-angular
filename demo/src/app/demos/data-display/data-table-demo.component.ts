import { ChangeDetectionStrategy, Component, computed, inject, input, OnDestroy, output, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { delay, of } from 'rxjs';
import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  CardContentComponent,
  CheckboxComponent,
  ColumnDef,
  ColumnResizeEvent,
  ContextMenuComponent,
  ContextMenuContentComponent,
  ContextMenuItemComponent,
  ContextMenuLabelComponent,
  ContextMenuSeparatorComponent,
  ContextMenuShortcutComponent,
  ContextMenuIntegrations,
  ContextMenuItem,
  DataTableComponent,
  SubRowContext,
  DataTableColumnState,
  DataTableDateFilterComponent,
  DataTableDateRangeFilterComponent,
  DataTableLoadingVisibility,
  DataTableMultiselectFilterComponent,
  DateRange,
  LabelComponent,
  PaginationState,
  RowActionContext,
  SeparatorComponent,
  SortState,
  SpinnerComponent,
  SubRowFilterMode,
  SubRowSelectionMode,
  SwitchComponent,
  ToastService,
  ToggleGroupComponent,
  ToggleGroupItemComponent,
  CellEditEvent,
  CellEditErrorEvent,
  RowReorderEvent,
  DataTableExportQuery,
  columnHelper,
  dateFilterFn,
  dateRangeFilterFn,
  multiselectFilterFn,
  computePivot,
  PivotAggregate,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { DATA_TABLE_DEMO_LOCALES } from './data-table-demo.locales';
import { Payment, OrgNode, OpsTicket } from '../shared/types';
import { StatusCellComponent } from '../../cells/status-cell.component';
import { AmountCellComponent } from '../../cells/amount-cell.component';
import { ActionsCellComponent } from '../../cells/actions-cell.component';
import { TextFilterComponent } from '../../filters/text-filter.component';

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
    const coords = pts.map(p => `${p.x},${p.y}`).join(' ');
    return `0,14 ${coords} 60,14`;
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
      const isLast = i === data.length - 1;
      let color: string;
      if (positive) {
        color = isLast ? '#22c55e' : '#86efac';
      } else {
        color = isLast ? '#ef4444' : '#fca5a5';
      }
      return {
        x: i * (barW + gap),
        y: 12 - h,
        w: barW,
        h,
        color,
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
export class FpsMeterComponent implements OnDestroy {
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
        content: row['notes'],
        minHeight: row['rowHeight'],
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
            value: row['metricValue'],
            delta: row['metricDelta'],
            target: row['metricTarget'],
            sparklineData: row['sparklineData'],
            label: row['metricLabel'],
            format: row['metricFormat'],
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
            toggled: (val: unknown) => { row['enabled'] = val; },
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
        cell: (row: VDemoRow) => {
          const val = row[`col${c}`];
          if (typeof val === 'string') return val;
          if (typeof val === 'number' || typeof val === 'boolean') return `${val}`;
          return '';
        },
      });
    }
  }

  return cols;
}

const VDEMO_DATA = generateVDemoData(10000, 100);

@Component({
  selector: 'app-ops-table-loader',
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
  readonly trigger = input<string>('initial');
  readonly total = input(0);
}

@Component({
  selector: 'app-ops-ticket-detail',
  imports: [CommonModule, BadgeComponent],
  template: `
    @if (ticket()) {
      <div class="space-y-4 p-3">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-semibold">{{ ticket()!.id }} &middot; {{ ticket()!.account }}</p>
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
  readonly ticket = input<OpsTicket | undefined>(undefined);
}

@Component({
  selector: 'app-data-table-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    CardContentComponent,
    CheckboxComponent,
    LabelComponent,
    SeparatorComponent,
    SpinnerComponent,
    SwitchComponent,
    ToggleGroupComponent,
    ToggleGroupItemComponent,
    DataTableComponent,
    ContextMenuComponent,
    ContextMenuContentComponent,
    ContextMenuItemComponent,
    ContextMenuLabelComponent,
    ContextMenuSeparatorComponent,
    ContextMenuShortcutComponent,
    ...ContextMenuIntegrations,
    FpsMeterComponent,
  ],
  templateUrl: './data-table-demo.component.html',
})
export class DataTableDemoComponent {
  private readonly toastService = inject(ToastService);
  private readonly localeId = inject(UI_LOCALE_ID);
  readonly t = computed(() => DATA_TABLE_DEMO_LOCALES[this.localeId()] ?? DATA_TABLE_DEMO_LOCALES['en']);

  // ── Pivot Demo (A6) ──
  readonly pivotSource = signal([
    { region: 'NA', product: 'Widgets', quarter: 'Q1', sales: 1200 },
    { region: 'NA', product: 'Gadgets', quarter: 'Q1', sales: 800 },
    { region: 'NA', product: 'Widgets', quarter: 'Q2', sales: 1500 },
    { region: 'EU', product: 'Widgets', quarter: 'Q1', sales: 600 },
    { region: 'EU', product: 'Gadgets', quarter: 'Q2', sales: 950 },
    { region: 'APAC', product: 'Widgets', quarter: 'Q2', sales: 700 },
    { region: 'APAC', product: 'Gadgets', quarter: 'Q1', sales: 400 },
  ]);
  readonly pivotDims = ['region', 'product', 'quarter'] as const;
  readonly pivotAggs: PivotAggregate[] = ['sum', 'avg', 'count', 'min', 'max'];
  readonly pivotRowDim = signal<string>('region');
  readonly pivotColDim = signal<string>('product');
  readonly pivotAgg = signal<PivotAggregate>('sum');
  readonly pivotResult = computed(() =>
    computePivot(this.pivotSource(), {
      rows: [this.pivotRowDim()],
      column: this.pivotColDim(),
      value: 'sales',
      aggregate: this.pivotAgg(),
      showRowTotals: true,
    }),
  );
  readonly pivotTableColumns = computed<ColumnDef<Record<string, unknown>>[]>(() =>
    this.pivotResult().columns.map((c) => ({ accessorKey: c.key, header: c.header, width: 'auto' })),
  );
  /** Toggles the demo table between the raw flat source and the pivoted result. */
  readonly pivotMode = signal(true);
  /** Columns for the raw, un-pivoted source table. */
  readonly pivotSourceColumns: ColumnDef<Record<string, unknown>>[] = [
    { accessorKey: 'region', header: 'Region' },
    { accessorKey: 'product', header: 'Product' },
    { accessorKey: 'quarter', header: 'Quarter' },
    { accessorKey: 'sales', header: 'Sales' },
  ];

  scrollTo(id: string, event: Event) {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Virtual Scroll Demo
  readonly virtualCellMode = signal<'light' | 'heavy'>('light');
  readonly virtualVariableRows = signal(false);
  readonly virtualRecycleEnabled = signal(false);
  readonly virtualDemoData = VDEMO_DATA;
  readonly virtualDemoColumns = computed(() =>
    generateVDemoColumns(100, this.virtualCellMode() === 'heavy', this.virtualVariableRows())
  );

  readonly payments = signal<Payment[]>([]);
  readonly selection = signal<Record<string, boolean>>({});
  readonly selectionCount = computed(() => Object.keys(this.selection()).filter(k => this.selection()[k]).length);

  readonly paymentColumns = computed<ColumnDef<Payment>[]>(() => {
    const locale = this.t();
    return [
      { accessorKey: 'id', header: locale.colId, enableSorting: true, sticky: true, width: '100px' },
      { accessorKey: 'email', header: locale.colEmail, enableSorting: true, width: 'auto' },
      { accessorKey: 'amount', header: locale.colAmount, enableSorting: true, width: '150px' },
      {
        accessorKey: 'status',
        header: locale.colStatus,
        enableSorting: true,
        enableFiltering: true,
        filterComponent: DataTableMultiselectFilterComponent,
        filterComponentInputs: {
          options: ['pending', 'processing', 'success', 'failed'],
          placeholder: 'Filter status...',
          title: locale.colStatus,
        },
        filterFn: (row: Payment, filterValue: unknown) =>
          multiselectFilterFn(row, filterValue as string[] | null, (r: Payment) => r.status),
        width: '150px',
      },
      { accessorKey: 'clientName', header: locale.colClientName, width: 'auto' },
      { accessorKey: 'role', header: locale.colRole, width: '150px' },
    ];
  });

  readonly hebrewRtlData = signal([
    { id: 'INV-001', customer: '\u05D0\u05DC\u05D5\u05DF \u05DB\u05D4\u05DF', amount: 1250, status: '\u05D4\u05D5\u05E9\u05DC\u05DD', date: '2024-06-15' },
    { id: 'INV-002', customer: '\u05DE\u05D9\u05DB\u05DC \u05DC\u05D5\u05D9', amount: 890, status: '\u05DE\u05DE\u05EA\u05D9\u05DF', date: '2024-06-14' },
    { id: 'INV-003', customer: '\u05D9\u05D5\u05E1\u05D9 \u05D0\u05D1\u05E8\u05D4\u05DD', amount: 2340, status: '\u05D4\u05D5\u05E9\u05DC\u05DD', date: '2024-06-10' },
    { id: 'INV-004', customer: '\u05E8\u05D5\u05E0\u05D9\u05EA \u05D3\u05D5\u05D3', amount: 560, status: '\u05D1\u05D5\u05D8\u05DC', date: '2024-05-28' },
    { id: 'INV-005', customer: '\u05E0\u05D5\u05E2\u05DD \u05E9\u05E8\u05D5\u05DF', amount: 3100, status: '\u05DE\u05DE\u05EA\u05D9\u05DF', date: '2024-06-01' },
    { id: 'INV-006', customer: '\u05E2\u05D3\u05D9 \u05D1\u05DF-\u05D0\u05E8\u05D9', amount: 1780, status: '\u05D4\u05D5\u05E9\u05DC\u05DD', date: '2024-05-20' },
    { id: 'INV-007', customer: '\u05D2\u05DC\u05D9\u05EA \u05E4\u05E8\u05D9\u05D3\u05DE\u05DF', amount: 420, status: '\u05DE\u05DE\u05EA\u05D9\u05DF', date: '2024-06-12' },
    { id: 'INV-008', customer: '\u05D0\u05D5\u05E8\u05D9 \u05DE\u05D6\u05E8\u05D7\u05D9', amount: 5200, status: '\u05D4\u05D5\u05E9\u05DC\u05DD', date: '2024-06-08' },
  ]);

  readonly hebrewRtlColumns: ColumnDef<{ id: string; customer: string; amount: number; status: string; date: string }>[] = [
    { accessorKey: 'id', header: '\u05DE\u05E1\u05E4\u05E8 \u05D7\u05E9\u05D1\u05D5\u05E0\u05D9\u05EA', width: '140px', enableSorting: true },
    { accessorKey: 'customer', header: '\u05DC\u05E7\u05D5\u05D7', width: 'auto', enableSorting: true },
    {
      accessorKey: 'amount',
      header: '\u05E1\u05DB\u05D5\u05DD',
      width: '120px',
      enableSorting: true,
      cell: (row) => `\u20AA${row.amount.toLocaleString('he-IL')}`,
    },
    {
      accessorKey: 'status',
      header: '\u05E1\u05D8\u05D8\u05D5\u05E1',
      width: '130px',
      enableSorting: true,
      enableFiltering: true,
      filterComponent: DataTableMultiselectFilterComponent,
      filterComponentInputs: {
        options: ['\u05D4\u05D5\u05E9\u05DC\u05DD', '\u05DE\u05DE\u05EA\u05D9\u05DF', '\u05D1\u05D5\u05D8\u05DC'],
        placeholder: '\u05E1\u05E0\u05DF \u05E1\u05D8\u05D8\u05D5\u05E1...',
        title: '\u05E1\u05D8\u05D8\u05D5\u05E1',
      },
      filterFn: (row: { status: string }, filterValue: unknown) =>
        multiselectFilterFn(row, filterValue as string[] | null, (r: { status: string }) => r.status),
    },
    {
      accessorKey: 'date',
      header: '\u05EA\u05D0\u05E8\u05D9\u05DA',
      width: '160px',
      enableSorting: true,
      enableFiltering: true,
      filterComponent: DataTableDateFilterComponent,
      filterComponentInputs: { locale: 'he' },
      filterFn: (row: { date: string }, filterValue: unknown) =>
        dateFilterFn(row, filterValue as Date | null, (r: { date: string }) => r.date),
      sortFn: (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    },
  ];

  readonly resizableColumns = computed<ColumnDef<Payment>[]>(() => {
    const locale = this.t();
    return [
      { accessorKey: 'id', header: locale.colId, enableSorting: true, width: '80px', minWidth: '60px' },
      { accessorKey: 'email', header: locale.colEmail, enableSorting: true, width: '250px', minWidth: '100px' },
      { accessorKey: 'amount', header: locale.colAmount, enableSorting: true, width: '120px', minWidth: '80px' },
      { accessorKey: 'status', header: locale.colStatus, enableSorting: true, width: '130px', minWidth: '80px' },
      { accessorKey: 'clientName', header: locale.colClientName, width: '200px', minWidth: '100px' },
      { accessorKey: 'role', header: locale.colRole, width: '120px', minWidth: '80px' },
    ];
  });

  onColumnResize(_event: ColumnResizeEvent): void {
    // Column resize handled by data table internally
  }

  readonly paymentRowActions = (ctx: RowActionContext<Payment>): ContextMenuItem[] => [
    {
      label: `View ${ctx.row.email}`,
      icon: 'eye',
      shortcut: '\u2318V',
      click: () => this.toastService.toast({ title: 'View', description: `Viewing payment ${ctx.row.id}` }),
    },
    {
      label: 'Edit Payment',
      icon: 'pencil',
      shortcut: '\u2318E',
      click: () => this.toastService.toast({ title: 'Edit', description: `Editing payment ${ctx.row.id}` }),
    },
    { type: 'separator' },
    {
      label: 'Delete',
      icon: 'trash',
      shortcut: '\u2318\u232b',
      click: () => this.toastService.toast({ title: 'Delete', description: `Deleted payment ${ctx.row.id}`, variant: 'destructive' }),
    },
  ];

  readonly customCellsColumns = computed<ColumnDef<Payment>[]>(() => {
    const locale = this.t();
    return [
      { accessorKey: 'id', header: locale.colId, enableSorting: true, width: '100px' },
      {
        accessorKey: 'email',
        header: locale.colEmail,
        enableSorting: true,
        width: 'auto',
        enableFiltering: true,
        filterComponent: TextFilterComponent,
      },
      {
        accessorKey: 'amount',
        header: locale.colAmount,
        enableSorting: true,
        width: '150px',
        component: AmountCellComponent,
        componentInputs: (row) => ({ amount: row.amount }),
      },
      {
        accessorKey: 'status',
        header: locale.colStatus,
        enableSorting: true,
        width: '150px',
        component: StatusCellComponent,
        componentInputs: (row) => ({ status: row.status }),
        sortFn: (a, b) => {
          const statusOrder: Record<string, number> = { success: 0, processing: 1, pending: 2, failed: 3 };
          return statusOrder[a.status] - statusOrder[b.status];
        },
      },
      {
        accessorKey: 'actions',
        header: locale.colActions,
        width: '200px',
        enableSorting: false,
        component: ActionsCellComponent,
        componentInputs: (row) => ({
          id: row.id,
          email: row.email,
        }),
        componentOutputs: (row) => ({
          view: () => this.handlePaymentAction('View', row),
          edit: () => this.handlePaymentAction('Edit', row),
        }),
      },
    ];
  });

  handlePaymentAction(action: string, payment: Payment): void {
    this.toastService.toast({
      title: `${action} Payment`,
      description: `${action} payment ${payment.id} for ${payment.email}`,
      variant: 'default',
    });
  }

  // Sub-Rows / Tree Data
  readonly treeSelectionMode = signal<SubRowSelectionMode>('descendants');
  readonly treeFilterMode = signal<SubRowFilterMode>('includeParentOnChildMatch');
  readonly treeDragMode = signal<'flat' | 'tree'>('flat');
  readonly treeDragEnabled = signal(false);
  readonly treeDragLog = signal<string[]>([]);

  private readonly treeTableRef = viewChild<DataTableComponent<OrgNode>>('treeTable');
  private readonly treeContextMenuRef = viewChild<ContextMenuComponent>('treeContextMenu');
  readonly treeContextData = computed(() =>
    this.treeContextMenuRef()?.data() as SubRowContext<OrgNode> | undefined
  );

  onTreeRowReorder(event: RowReorderEvent<OrgNode>): void {
    const table = this.treeTableRef();
    if (table) {
      this.orgTreeData.set(table.reorderData(this.orgTreeData(), event));
    }

    const position = event.position;
    const target = event.targetRow.name;
    if (position === 'on') {
      this.treeDragLog.update(log => [`"${event.row.name}" → child of "${target}" (reparent)`, ...log.slice(0, 3)]);
    } else {
      this.treeDragLog.update(log => [`"${event.row.name}" → ${position} "${target}" (after:${event.previousId ?? 'start'}, before:${event.nextId ?? 'end'})`, ...log.slice(0, 3)]);
    }
  }

  readonly orgTreeData = signal<OrgNode[]>([
    {
      id: 'eng', name: 'Engineering', role: 'Department', headcount: 42, budget: 2800000,
      children: [
        {
          id: 'eng-fe', name: 'Frontend', role: 'Team', headcount: 14, budget: 900000,
          children: [
            { id: 'eng-fe-web', name: 'Web Platform', role: 'Squad', headcount: 6, budget: 400000, children: [
              { id: 'p-alice', name: 'Alice Chen', role: 'Tech Lead', headcount: 1, budget: 180000 },
              { id: 'p-bob', name: 'Bob Park', role: 'Senior Engineer', headcount: 1, budget: 160000 },
              { id: 'p-carol', name: 'Carol Wu', role: 'Engineer', headcount: 1, budget: 130000 },
            ]},
            { id: 'eng-fe-mobile', name: 'Mobile', role: 'Squad', headcount: 5, budget: 350000, children: [
              { id: 'p-dave', name: 'Dave Kim', role: 'Tech Lead', headcount: 1, budget: 175000 },
              { id: 'p-eve', name: 'Eve Singh', role: 'Engineer', headcount: 1, budget: 130000 },
            ]},
            { id: 'eng-fe-design', name: 'Design Systems', role: 'Squad', headcount: 3, budget: 250000 },
          ],
        },
        {
          id: 'eng-be', name: 'Backend', role: 'Team', headcount: 18, budget: 1200000,
          children: [
            { id: 'eng-be-api', name: 'API Platform', role: 'Squad', headcount: 8, budget: 550000, children: [
              { id: 'p-frank', name: 'Frank Li', role: 'Principal Engineer', headcount: 1, budget: 200000 },
              { id: 'p-grace', name: 'Grace Obi', role: 'Senior Engineer', headcount: 1, budget: 165000 },
            ]},
            { id: 'eng-be-data', name: 'Data Pipeline', role: 'Squad', headcount: 6, budget: 420000 },
            { id: 'eng-be-infra', name: 'Infrastructure', role: 'Squad', headcount: 4, budget: 330000 },
          ],
        },
        {
          id: 'eng-qa', name: 'QA', role: 'Team', headcount: 10, budget: 700000,
          children: [
            { id: 'eng-qa-auto', name: 'Automation', role: 'Squad', headcount: 6, budget: 420000 },
            { id: 'eng-qa-manual', name: 'Manual Testing', role: 'Squad', headcount: 4, budget: 280000 },
          ],
        },
      ],
    },
    {
      id: 'product', name: 'Product', role: 'Department', headcount: 15, budget: 1500000,
      children: [
        { id: 'prod-core', name: 'Core Product', role: 'Team', headcount: 8, budget: 850000, children: [
          { id: 'p-hannah', name: 'Hannah Lee', role: 'Product Manager', headcount: 1, budget: 170000 },
          { id: 'p-ivan', name: 'Ivan Petrov', role: 'Product Designer', headcount: 1, budget: 145000 },
        ]},
        { id: 'prod-growth', name: 'Growth', role: 'Team', headcount: 7, budget: 650000 },
      ],
    },
    {
      id: 'marketing', name: 'Marketing', role: 'Department', headcount: 12, budget: 1100000,
      children: [
        { id: 'mkt-content', name: 'Content', role: 'Team', headcount: 5, budget: 450000 },
        { id: 'mkt-perf', name: 'Performance', role: 'Team', headcount: 4, budget: 380000 },
        { id: 'mkt-brand', name: 'Brand', role: 'Team', headcount: 3, budget: 270000 },
      ],
    },
    { id: 'finance', name: 'Finance', role: 'Department', headcount: 8, budget: 750000 },
    { id: 'hr', name: 'Human Resources', role: 'Department', headcount: 6, budget: 520000 },
  ]);

  readonly orgTreeColumns = computed<ColumnDef<OrgNode>[]>(() => {
    const locale = this.t();
    return [
      { accessorKey: 'name', header: locale.colName, enableSorting: true, width: 'auto', minWidth: '250px' },
      { accessorKey: 'role', header: locale.colRole, enableSorting: true, width: '180px' },
      { accessorKey: 'headcount', header: locale.colHeadcount, enableSorting: true, width: '120px',
        cell: (row) => String(row.headcount) },
      { accessorKey: 'budget', header: locale.colBudget, enableSorting: true, width: '150px',
        cell: (row) => '$' + row.budget.toLocaleString() },
    ];
  });

  onTreeTableContextMenu(_event: unknown): void {
    // Context menu handled by data table internally
  }

  onTreeTableAction(action: string, ctx: { row?: OrgNode; depth: number; isLeaf: boolean; childCount?: number }): void {
    this.toastService.toast({
      title: `${action} \u2014 ${ctx.row?.name}`,
      description: `Depth: ${ctx.depth}, Leaf: ${ctx.isLeaf}, Children: ${ctx.childCount ?? 0}`,
      variant: 'default',
    });
  }

  // Server-Side
  readonly serverData = signal<Payment[]>([]);
  readonly serverTotal = signal(0);
  readonly serverLoading = signal(true);
  readonly serverSort = signal<SortState>({ column: 'email', direction: 'asc' });
  readonly serverPagination = signal<PaginationState>({ pageIndex: 0, pageSize: 10 });
  readonly serverFilter = signal('');
  readonly serverColumnFilters = signal<Record<string, unknown>>({});

  onServerSort(sort: SortState): void {
    this.serverSort.set(sort);
    this.loadServerData();
  }

  onServerPage(page: PaginationState): void {
    this.serverPagination.set(page);
    this.loadServerData();
  }

  onServerFilter(filter: string): void {
    this.serverFilter.set(filter);
    this.serverPagination.update(p => ({ ...p, pageIndex: 0 }));
    this.loadServerData();
  }

  onServerColumnFilters(filters: Record<string, unknown>): void {
    this.serverColumnFilters.set(filters);
    this.serverPagination.update(p => ({ ...p, pageIndex: 0 }));
    this.loadServerData();
  }

  // Ops grid
  private readonly opsGridRef = viewChild<DataTableComponent<OpsTicket>>('opsGrid');
  readonly opsSource = signal<OpsTicket[]>([]);
  readonly opsData = signal<OpsTicket[]>([]);
  readonly opsTotal = signal(0);
  readonly opsLoading = signal(false);
  readonly opsFilter = signal('');
  readonly opsColumnFilters = signal<Record<string, unknown>>({});
  readonly opsPagination = signal<PaginationState>({ pageIndex: 0, pageSize: 10 });
  readonly opsSort = signal<SortState>({ column: '', direction: null });
  readonly opsMultiSort = signal<SortState[]>([]);
  readonly opsColumnOrder = signal<string[]>([]);
  readonly opsColumnVisibility = signal<Record<string, boolean>>({ createdAt: false });
  readonly opsExpandedRows = signal<Record<string, boolean>>({});
  readonly opsSavedLayout = signal<DataTableColumnState[] | null>(null);
  readonly opsLoadingVisibility = signal<DataTableLoadingVisibility>({
    initial: true,
    pagination: true,
    sorting: true,
    filtering: true,
  });

  readonly opsLoaderComponent = OpsTableLoaderComponent;
  readonly opsDetailComponent = OpsTicketDetailComponent;
  readonly opsDetailInputs = (ticket: OpsTicket) => ({ ticket });

  readonly opsColumns = computed<ColumnDef<OpsTicket>[]>(() => {
    const locale = this.t();
    return [
      {
        accessorKey: 'id',
        header: locale.colTicket,
        pin: 'left',
        width: '130px',
        enableSorting: true,
        enableHiding: false,
        enableReordering: false,
      },
      { accessorKey: 'account', header: locale.colAccount, width: '180px', enableSorting: true },
      { accessorKey: 'service', header: locale.colService, width: '160px', enableSorting: true },
      { accessorKey: 'region', header: locale.colRegion, width: '110px', enableSorting: true },
      {
        accessorKey: 'priority',
        header: locale.colPriority,
        width: '95px',
        enableSorting: true,
        sortFn: (a, b) => ({ P1: 0, P2: 1, P3: 2, P4: 3 } as Record<string, number>)[a.priority] - ({ P1: 0, P2: 1, P3: 2, P4: 3 } as Record<string, number>)[b.priority],
      },
      {
        accessorKey: 'status',
        header: locale.colStatus,
        width: '140px',
        enableSorting: true,
        sortFn: (a, b) => ({ Open: 0, Investigating: 1, Mitigated: 2, Resolved: 3 } as Record<string, number>)[a.status] - ({ Open: 0, Investigating: 1, Mitigated: 2, Resolved: 3 } as Record<string, number>)[b.status],
      },
      { accessorKey: 'owner', header: locale.colOwner, width: '140px', enableSorting: true },
      {
        accessorKey: 'mrr',
        header: locale.colMrr,
        width: '120px',
        enableSorting: true,
        cell: (row) => `$${row.mrr.toLocaleString()}`,
        enableGlobalFilter: false,
      },
      { accessorKey: 'slaMinutes', header: locale.colSla, width: '100px', enableSorting: true },
      {
        accessorKey: 'updatedAt',
        header: locale.colUpdated,
        width: '160px',
        enableSorting: true,
        enableFiltering: true,
        filterComponent: DataTableDateRangeFilterComponent,
        filterFn: (row: OpsTicket, filterValue: unknown): boolean =>
          dateRangeFilterFn(row, filterValue as DateRange | null, r => r.updatedAt),
        sortFn: (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
      },
      {
        accessorKey: 'createdAt',
        header: locale.colCreated,
        width: '160px',
        enableSorting: true,
        enableFiltering: true,
        filterComponent: DataTableDateFilterComponent,
        filterFn: (row: OpsTicket, filterValue: unknown): boolean =>
          dateFilterFn(row, filterValue as Date | null, r => r.createdAt),
        sortFn: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      },
      { accessorKey: 'summary', header: locale.colSummary, width: 'auto', enableSorting: false, enableGlobalFilter: false },
    ];
  });

  onOpsFilter(filter: string): void {
    this.opsFilter.set(filter);
    this.opsPagination.update((state) => ({ ...state, pageIndex: 0 }));
    this.loadOpsData();
  }

  onOpsPage(page: PaginationState): void {
    this.opsPagination.set(page);
    this.loadOpsData();
  }

  onOpsSort(sort: SortState): void {
    this.opsSort.set(sort);
  }

  onOpsMultiSort(sorts: SortState[]): void {
    this.opsMultiSort.set(sorts);
    this.loadOpsData();
  }

  onOpsColumnFilters(filters: Record<string, unknown>): void {
    this.opsColumnFilters.set(filters);
    this.opsPagination.update(p => ({ ...p, pageIndex: 0 }));
    this.loadOpsData();
  }

  toggleOpsLoaderTrigger(trigger: keyof DataTableLoadingVisibility, enabled: boolean): void {
    this.opsLoadingVisibility.update((state) => ({ ...state, [trigger]: enabled }));
  }

  refreshOpsData(): void {
    this.opsGridRef()?.setLoadingTrigger('initial');
    this.loadOpsData();
  }

  saveOpsLayout(): void {
    const table = this.opsGridRef();
    if (!table) return;
    this.opsSavedLayout.set(table.getColumnState());
    this.toastService.success('Layout Saved', 'Column layout state saved for this session.');
  }

  restoreOpsLayout(): void {
    const table = this.opsGridRef();
    const layout = this.opsSavedLayout();
    if (!table || !layout) return;

    table.applyColumnState(layout);
    this.opsColumnOrder.set(table.columnOrder());
    this.opsColumnVisibility.set(table.columnVisibility());
    this.toastService.toast({ title: 'Layout Restored', description: 'Saved layout re-applied.' });
  }

  applyOpsCompactPreset(): void {
    const table = this.opsGridRef();
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

  moveOpsPriorityToFront(): void {
    const table = this.opsGridRef();
    if (!table) return;
    table.moveColumn('priority', 1);
    this.opsColumnOrder.set(table.columnOrder());
  }

  readonly opsExportProvider = async (): Promise<OpsTicket[]> => {
    await new Promise(resolve => setTimeout(resolve, 400));
    return this.getFilteredSortedOpsData();
  };

  constructor() {
    const clientNames = ['Acme Corp', 'TechStart Inc', 'Global Solutions', 'Innovation Labs', 'Digital Ventures'];
    const roles = ['Admin', 'User', 'Manager', 'Developer', 'Designer'];

    const data: Payment[] = Array.from({ length: 100 }, (_, i) => ({
      id: `PAY-${i + 1}`,
      amount: Math.floor(Math.random() * 500) + 50,
      status: (['pending', 'processing', 'success', 'failed'] as const)[Math.floor(Math.random() * 4)],
      email: `user${i + 1}@example.com`,
      clientName: clientNames[Math.floor(Math.random() * clientNames.length)],
      role: roles[Math.floor(Math.random() * roles.length)],
    }));
    this.payments.set(data);
    this.editableData.set(data.slice(0, 8));
    this.draggableData.set(data.slice(0, 6));

    this.loadServerData();
    this.createOpsDataset();
    this.loadOpsData();
  }

  /**
   * Shared "server" query: filter (global + per-column) then sort, with NO
   * pagination. Used by both the page loader and the export-all provider so
   * the export mirrors exactly what the grid would show.
   */
  private queryServerData(query: {
    globalFilter: string;
    columnFilters: Record<string, unknown>;
    sort: SortState;
  }): Payment[] {
    let rows = this.payments();

    const filter = query.globalFilter.toLowerCase();
    if (filter) {
      rows = rows.filter(row =>
        Object.values(row).some(val => String(val).toLowerCase().includes(filter))
      );
    }

    for (const key of Object.keys(query.columnFilters)) {
      const val = query.columnFilters[key];
      if (val === null || val === undefined || val === '') continue;
      const col = this.paymentColumns().find(c => c.accessorKey === key);
      if (col?.filterFn) {
        rows = rows.filter(row => col.filterFn!(row, val));
      }
    }

    const sort = query.sort;
    if (sort.column && sort.direction) {
      rows = [...rows].sort((a, b) => {
        const aVal = (a as unknown as Record<string, unknown>)[sort.column];
        const bVal = (b as unknown as Record<string, unknown>)[sort.column];
        if (aVal! < bVal!) return sort.direction === 'asc' ? -1 : 1;
        if (aVal! > bVal!) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return rows;
  }

  /**
   * Server-side export-all provider: returns EVERY row matching the current
   * filter + sort (across all pages), not just the loaded page.
   */
  readonly serverExportAll = async (query: DataTableExportQuery): Promise<Payment[]> =>
    this.queryServerData(query);

  private loadServerData(): void {
    this.serverLoading.set(true);
    const { pageIndex, pageSize } = this.serverPagination();

    of(null).pipe(delay(1000)).subscribe(() => {
      const filtered = this.queryServerData({
        globalFilter: this.serverFilter(),
        columnFilters: this.serverColumnFilters(),
        sort: this.serverSort(),
      });

      const start = pageIndex * pageSize;
      this.serverData.set(filtered.slice(start, start + pageSize));
      this.serverTotal.set(filtered.length);
      this.serverLoading.set(false);
    });
  }

  private createOpsDataset(): void {
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

  private loadOpsData(): void {
    this.opsLoading.set(true);

    const { pageIndex, pageSize } = this.opsPagination();

    of(null).pipe(delay(650)).subscribe(() => {
      const rows = this.getFilteredSortedOpsData();
      const total = rows.length;
      const start = pageIndex * pageSize;
      const paged = rows.slice(start, start + pageSize);

      this.opsData.set(paged);
      this.opsTotal.set(total);
      this.opsLoading.set(false);
    });
  }

  private getFilteredSortedOpsData(): OpsTicket[] {
    const source = this.opsSource();
    const filter = this.opsFilter().toLowerCase();
    const sorts = this.resolveOpsSorts();
    const colFilters = this.opsColumnFilters();

    let rows = source;

    if (filter) {
      rows = rows.filter(row =>
        [row.id, row.account, row.service, row.owner, row.status, row.summary, row.tags.join(' ')]
          .join(' ')
          .toLowerCase()
          .includes(filter)
      );
    }

    for (const key of Object.keys(colFilters)) {
      const filterValue = colFilters[key];
      if (filterValue === null || filterValue === undefined || filterValue === '') continue;
      const col = this.opsColumns().find(c => c.accessorKey === key);
      if (col?.filterFn) {
        rows = rows.filter(row => col.filterFn!(row, filterValue));
      }
    }

    if (sorts.length > 0) {
      rows = [...rows].sort((a, b) => {
        for (const sort of sorts) {
          const key = sort.column as keyof OpsTicket;
          const direction = sort.direction === 'desc' ? -1 : 1;
          const aVal = a[key];
          const bVal = b[key];
          if (aVal === bVal) continue;
          return this.compareOpsSortValues(aVal, bVal) * direction;
        }
        return 0;
      });
    }

    return rows;
  }

  private resolveOpsSorts(): SortState[] {
    const multiSort = this.opsMultiSort();
    if (multiSort.length > 0) {
      return multiSort;
    }
    const singleSort = this.opsSort();
    return singleSort.direction ? [singleSort] : [];
  }

  private compareOpsSortValues(aVal: OpsTicket[keyof OpsTicket], bVal: OpsTicket[keyof OpsTicket]): number {
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return aVal > bVal ? 1 : -1;
    }
    if (aVal instanceof Date && bVal instanceof Date) {
      return aVal.getTime() > bVal.getTime() ? 1 : -1;
    }
    const aText = this.normalizeOpsSortValue(aVal);
    const bText = this.normalizeOpsSortValue(bVal);
    return aText.localeCompare(bText);
  }

  private normalizeOpsSortValue(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') return `${value}`;
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(item => this.normalizeOpsSortValue(item)).join('|');
    if (value && typeof value === 'object') return JSON.stringify(value);
    return '';
  }

  // ── Inline Editing Demo ──
  readonly editableData = signal<Payment[]>([]);
  readonly editableColumns = computed<ColumnDef<Payment>[]>(() => {
    const locale = this.t();
    return [
      { accessorKey: 'id', header: locale.colId, width: '100px' },
      {
        accessorKey: 'clientName', header: locale.colClientName, width: 'auto',
        editable: true, editType: 'text',
        editValidator: (val) => String(val).trim().length > 0 || 'Client name is required',
        valueSetter: (row, val) => ({ ...row, clientName: String(val) }),
      },
      {
        accessorKey: 'email', header: locale.colEmail, width: 'auto',
        editable: true, editType: 'text',
        editValidator: (val) => String(val).includes('@') || 'Enter a valid email address',
        valueSetter: (row, val) => ({ ...row, email: String(val) }),
      },
      {
        accessorKey: 'amount', header: locale.colAmount, width: '120px',
        editable: true, editType: 'number',
        editValidator: (val) => Number(val) > 0 || 'Amount must be greater than zero',
        valueSetter: (row, val) => ({ ...row, amount: Number(val) }),
        cell: (row) => `$${row.amount.toFixed(2)}`,
      },
      {
        accessorKey: 'status', header: locale.colStatus, width: '140px',
        editable: true, editType: 'select',
        editOptions: [
          { label: 'Pending', value: 'pending' },
          { label: 'Processing', value: 'processing' },
          { label: 'Success', value: 'success' },
          { label: 'Failed', value: 'failed' },
        ],
        valueSetter: (row, val) => ({ ...row, status: val as Payment['status'] }),
      },
    ];
  });
  readonly editLog = signal<string[]>([]);
  onCellEdit(event: CellEditEvent<Payment>): void {
    this.editLog.update(log => [`${String(event.column.accessorKey)}: "${String(event.oldValue)}" → "${String(event.newValue)}"`, ...log.slice(0, 4)]);
  }
  onCellEditError(event: CellEditErrorEvent<Payment>): void {
    this.editLog.update(log => [`⚠ ${String(event.column.accessorKey)} rejected: ${event.message}`, ...log.slice(0, 4)]);
  }

  // ── Footer Aggregations Demo ──
  readonly footerColumns = computed<ColumnDef<Payment>[]>(() => {
    const locale = this.t();
    return [
      { accessorKey: 'id', header: locale.colId, width: '100px', footer: 'Total' },
      { accessorKey: 'clientName', header: locale.colClient, width: 'auto', aggregateFn: 'count' },
      { accessorKey: 'email', header: locale.colEmail, width: 'auto' },
      { accessorKey: 'amount', header: locale.colAmount, width: '120px', aggregateFn: 'sum', cell: (row) => `$${row.amount.toFixed(2)}` },
      { accessorKey: 'status', header: locale.colStatus, width: '130px' },
    ];
  });

  // ── Row Grouping Demo ──
  readonly groupCollapsed = signal<Record<string, boolean>>({});
  readonly groupingColumns = computed<ColumnDef<Payment>[]>(() => {
    const locale = this.t();
    return [
      { accessorKey: 'id', header: locale.colId, width: '100px' },
      { accessorKey: 'clientName', header: locale.colClient, width: 'auto' },
      { accessorKey: 'email', header: locale.colEmail, width: 'auto' },
      {
        accessorKey: 'amount',
        header: locale.colAmount,
        width: '140px',
        aggregateFn: 'sum',
        cell: (row) => `$${row.amount.toFixed(2)}`,
      },
      { accessorKey: 'status', header: locale.colStatus, width: '140px', aggregateFn: 'count' },
    ];
  });
  readonly groupTableRef = viewChild<DataTableComponent<Payment>>('groupTable');
  expandAllGroups(): void {
    this.groupTableRef()?.expandAllGroups();
  }
  collapseAllGroups(): void {
    this.groupTableRef()?.collapseAllGroups();
  }

  // ── Column Header Menu Demo ──
  readonly menuColumns = computed<ColumnDef<Payment>[]>(() => {
    const locale = this.t();
    return [
      { accessorKey: 'id', header: locale.colId, width: '100px' },
      { accessorKey: 'clientName', header: locale.colClientName, width: 'auto' },
      { accessorKey: 'email', header: locale.colEmail, width: 'auto' },
      { accessorKey: 'amount', header: locale.colAmount, width: '120px', cell: (row) => `$${row.amount.toFixed(2)}` },
      { accessorKey: 'status', header: locale.colStatus, width: '130px' },
      { accessorKey: 'role', header: locale.colRole, width: '130px' },
    ];
  });

  // ── Row Disabling Demo ──
  readonly disabledRowIds = signal<string[]>([]);
  readonly isPaymentDisabled = (row: Payment): boolean => row.status === 'failed';

  // ── Row Drag Demo ──
  readonly draggableData = signal<Payment[]>([]);
  readonly dragLog = signal<string[]>([]);
  onRowReorder(event: RowReorderEvent<Payment>): void {
    const data = [...this.draggableData()];
    const [moved] = data.splice(event.fromIndex, 1);
    data.splice(event.toIndex, 0, moved);
    this.draggableData.set(data);
    const afterLabel = event.previousId ?? 'start';
    const beforeLabel = event.nextId ?? 'end';
    this.dragLog.update(log => [`"${moved.clientName}" → after ${afterLabel}, before ${beforeLabel} (${event.position})`, ...log.slice(0, 2)]);
  }

  // ── Floating Filters Demo ──
  readonly floatingFilterColumns = computed<ColumnDef<Payment>[]>(() => {
    const locale = this.t();
    return [
      { accessorKey: 'id', header: locale.colId, width: '100px', enableFiltering: true },
      { accessorKey: 'clientName', header: locale.colClient, width: 'auto', enableFiltering: true },
      { accessorKey: 'email', header: locale.colEmail, width: 'auto', enableFiltering: true },
      { accessorKey: 'amount', header: locale.colAmount, width: '120px', cell: (row) => `$${row.amount.toFixed(2)}` },
      { accessorKey: 'status', header: locale.colStatus, width: '130px', enableFiltering: true },
    ];
  });

  // ── Column Builder Demo ──
  readonly builderColumns = computed<ColumnDef<Payment>[]>(() => {
    const locale = this.t();
    return columnHelper<Payment>()
      .accessor('id', locale.colId, { width: '100px', enableSorting: true })
      .accessor('clientName', locale.colClientName, { width: 'auto', enableSorting: true })
      .accessor('email', locale.colEmail, { width: 'auto' })
      .accessor('amount', locale.colAmount, { width: '120px', cell: (row) => `$${row.amount.toFixed(2)}` })
      .accessor('status', locale.colStatus, { width: '130px' })
      .build();
  });
}
