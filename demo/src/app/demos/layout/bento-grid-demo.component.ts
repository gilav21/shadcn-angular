import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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

@Component({
  selector: 'app-bento-grid-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BentoGridComponent],
  template: `
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 id="bento-grid" class="text-2xl font-semibold scroll-m-20">Bento Grid (Dashboard)</h2>
        <button (click)="toggleEditMode()" (keydown.enter)="toggleEditMode()"
          class="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors">
          {{ isEditMode() ? 'Done' : 'Edit Layout' }}
        </button>
      </div>
      <p class="text-muted-foreground">
        A dashboard builder with drag-and-drop, resizable, and mergeable cells.
      </p>

      <div class="flex gap-6">
        @if (isEditMode()) {
        <aside class="w-64 flex-none space-y-4">
          <div class="font-medium text-sm text-muted-foreground mb-2">Components</div>
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
            <p>Drag components onto the grid to add them.</p>
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

  readonly isEditMode = signal(false);
  readonly widgets = signal<{ id: string; title: string; component: DashboardItem['content']; icon: string }[]>([
    { id: 'metric', title: 'Metric Card', component: MetricWidgetComponent, icon: '📊' },
    { id: 'calendar', title: 'Calendar', component: CalendarWidgetComponent, icon: '📅' },
    { id: 'team', title: 'Team Members', component: TeamWidgetComponent, icon: '👥' },
    { id: 'activity', title: 'Activity Feed', component: ActivityWidgetComponent, icon: '🔔' },
  ]);

  readonly dashboardItems = signal<DashboardItem[]>([
    {
      id: '1', x: 1, y: 1, cols: 4, rows: 2,
      content: MetricWidgetComponent,
      inputs: { title: 'Total Revenue', value: '$45,231.89', trend: 20.1 },
    },
    {
      id: '2', x: 5, y: 1, cols: 4, rows: 2,
      content: MetricWidgetComponent,
      inputs: { title: 'Subscriptions', value: '+2350', trend: 180.1 },
    },
    {
      id: '3', x: 9, y: 1, cols: 4, rows: 2,
      content: MetricWidgetComponent,
      inputs: { title: 'Sales', value: '+12,234', trend: 19 },
    },
    {
      id: '4', x: 1, y: 3, cols: 8, rows: 4,
      content: ActivityWidgetComponent,
    },
    {
      id: '5', x: 9, y: 3, cols: 4, rows: 4,
      content: TeamWidgetComponent,
    },
    {
      id: '6', x: 1, y: 7, cols: 4, rows: 4,
      content: CalendarWidgetComponent,
    },
    {
      id: '7', x: 5, y: 7, cols: 4, rows: 3,
      content: ActionWidgetComponent,
      outputs: {
        action: (type: string) => this.onWidgetAction(type),
      },
    },
  ]);

  onExternalDrop(event: { widgetId: string; targetId: string | null; x?: number; y?: number }) {
    const widget = this.widgets().find(w => w.id === event.widgetId);
    if (!widget) return;

    this.dashboardItems.update(items =>
      items.map(item => {
        if (item.id === event.targetId) {
          return {
            ...item,
            content: widget.component,
            inputs: widget.id === 'metric' ? { title: 'New Metric', value: '0', trend: 0 } : {},
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
