import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ToastService } from '../../../../../packages/components/ui';
import {
  BentoGridComponent,
  DashboardItem,
} from '../../../../../packages/components/ui/bento-grid';
import {
  MetricWidgetComponent,
  CalendarWidgetComponent,
  TeamWidgetComponent,
  ActivityWidgetComponent,
  ActionWidgetComponent,
} from '../../dashboard-widgets';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { BENTO_GRID_DEMO_LOCALES } from './bento-grid-demo.locales';

@Component({
  selector: 'app-bento-grid-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BentoGridComponent],
  template: `
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 id="bento-grid" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
        <button (click)="toggleEditMode()" (keydown.enter)="toggleEditMode()"
          class="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors">
          {{ isEditMode() ? t().done : t().editLayout }}
        </button>
      </div>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="flex gap-6">
        @if (isEditMode()) {
        <aside class="w-64 flex-none space-y-4">
          <div class="font-medium text-sm text-muted-foreground mb-2">{{ t().componentsLabel }}</div>
          <div class="grid gap-2">
            @for (widget of widgets(); track widget.id) {
            <div
              class="flex items-center gap-3 p-3 rounded-md border bg-card hover:bg-accent/50 cursor-grab active:cursor-grabbing transition-colors"
              draggable="true"
              (dragstart)="$event.dataTransfer?.setData('application/json', '{&quot;type&quot;:&quot;widget&quot;, &quot;id&quot;:&quot;' + widget.id + '&quot;}')">
              <span class="text-xl">{{ widget.icon }}</span>
              <span class="font-medium text-sm">{{ widget.title }}</span>
            </div>
            }
          </div>
          <div class="p-4 bg-muted/50 rounded-lg text-xs text-muted-foreground">
            <p>{{ t().dragHint }}</p>
          </div>
        </aside>
        }

        <div class="flex-1 p-6 border rounded-lg bg-zinc-50/50 dark:bg-zinc-900/50 min-h-[600px]">
          <ui-bento-grid [items]="dashboardItems()" [editable]="isEditMode()"
            (itemsChange)="onDashboardItemsChange($event)" (externalDrop)="onExternalDrop($event)" />
        </div>
      </div>
    </section>
  `,
})
export class BentoGridDemoComponent {
  private readonly toastService = inject(ToastService);
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => BENTO_GRID_DEMO_LOCALES[this.localeId()] ?? BENTO_GRID_DEMO_LOCALES['en']);

  readonly isEditMode = signal(false);
  readonly widgets = signal<{ id: string; title: string; component: DashboardItem['content']; icon: string }[]>([]);
  readonly dashboardItems = signal<DashboardItem[]>([]);

  constructor() {
    effect(() => {
      const loc = this.t();
      this.widgets.set([
        { id: 'metric', title: loc.widgetMetricTitle, component: MetricWidgetComponent, icon: '📊' },
        { id: 'calendar', title: loc.widgetCalendarTitle, component: CalendarWidgetComponent, icon: '📅' },
        { id: 'team', title: loc.widgetTeamTitle, component: TeamWidgetComponent, icon: '👥' },
        { id: 'activity', title: loc.widgetActivityTitle, component: ActivityWidgetComponent, icon: '🔔' },
      ]);
      this.dashboardItems.set([
        { id: '1', x: 1, y: 1, cols: 4, rows: 2, content: MetricWidgetComponent, inputs: { title: loc.metricRevenue, value: '$45,231.89', trend: 20.1 } },
        { id: '2', x: 5, y: 1, cols: 4, rows: 2, content: MetricWidgetComponent, inputs: { title: loc.metricSubscriptions, value: '+2350', trend: 180.1 } },
        { id: '3', x: 9, y: 1, cols: 4, rows: 2, content: MetricWidgetComponent, inputs: { title: loc.metricSales, value: '+12,234', trend: 19 } },
        { id: '4', x: 1, y: 3, cols: 8, rows: 4, content: ActivityWidgetComponent },
        { id: '5', x: 9, y: 3, cols: 4, rows: 4, content: TeamWidgetComponent },
        { id: '6', x: 1, y: 7, cols: 4, rows: 4, content: CalendarWidgetComponent },
        { id: '7', x: 5, y: 7, cols: 4, rows: 3, content: ActionWidgetComponent, outputs: { action: (type: string) => this.onWidgetAction(type) } },
      ]);
    });
  }

  onExternalDrop(event: { widgetId: string; targetId: string | null; x?: number; y?: number }) {
    const widget = this.widgets().find(w => w.id === event.widgetId);
    if (!widget) return;

    this.dashboardItems.update(items =>
      items.map(item => {
        if (item.id === event.targetId) {
          return {
            ...item,
            content: widget.component,
            inputs: widget.id === 'metric' ? { title: this.t().metricNewLabel, value: '0', trend: 0 } : {},
          };
        }
        return item;
      })
    );
  }

  onDashboardItemsChange(items: DashboardItem[]) {
    this.dashboardItems.set(items);
  }

  toggleEditMode() {
    this.isEditMode.update(v => !v);
  }

  onWidgetAction(type: string) {
    this.toastService.success('Widget Action', `Action triggered: ${type}`);
  }
}
