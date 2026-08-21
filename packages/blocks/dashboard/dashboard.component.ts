import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../../components/lib/utils';
import { BarChartComponent } from '../../components/ui/bar-chart';
import { StatCardComponent } from '../../components/ui/stat-card';
import {
  CardComponent,
  CardHeaderComponent,
  CardTitleComponent,
  CardDescriptionComponent,
  CardContentComponent,
} from '../../components/ui/card';
import {
  TableComponent,
  TableHeaderComponent,
  TableBodyComponent,
  TableRowComponent,
  TableHeadComponent,
  TableCellComponent,
} from '../../components/ui/table';
import {
  AvatarComponent,
  AvatarFallbackComponent,
} from '../../components/ui/avatar';

interface Stat {
  readonly label: string;
  readonly value: string;
  readonly delta: string;
  readonly positive: boolean;
}

interface ActivityRow {
  readonly initials: string;
  readonly name: string;
  readonly action: string;
  readonly time: string;
}

@Component({
  selector: 'ui-dashboard-block',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BarChartComponent,
    StatCardComponent,
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardDescriptionComponent,
    CardContentComponent,
    TableComponent,
    TableHeaderComponent,
    TableBodyComponent,
    TableRowComponent,
    TableHeadComponent,
    TableCellComponent,
    AvatarComponent,
    AvatarFallbackComponent,
  ],
  templateUrl: './dashboard.component.html',
  host: { class: 'block' },
})
export class DashboardBlockComponent {
  readonly class = input('');

  readonly stats: readonly Stat[] = [
    { label: 'Revenue', value: '$45,231', delta: '+12.5%', positive: true },
    { label: 'Active users', value: '2,340', delta: '+8.1%', positive: true },
    { label: 'Orders', value: '1,210', delta: '-3.2%', positive: false },
    { label: 'Churn rate', value: '1.8%', delta: '-0.4%', positive: true },
  ];

  readonly chartData: { name: string; value: number }[] = [
    { name: 'Jan', value: 18 },
    { name: 'Feb', value: 24 },
    { name: 'Mar', value: 31 },
    { name: 'Apr', value: 27 },
    { name: 'May', value: 38 },
    { name: 'Jun', value: 45 },
  ];

  readonly activity: readonly ActivityRow[] = [
    { initials: 'AL', name: 'Ada Lovelace', action: 'Created an account', time: '2m ago' },
    { initials: 'GH', name: 'Grace Hopper', action: 'Upgraded to Pro', time: '1h ago' },
    { initials: 'AT', name: 'Alan Turing', action: 'Invited a teammate', time: '3h ago' },
    { initials: 'KJ', name: 'Katherine Johnson', action: 'Closed an order', time: 'Yesterday' },
  ];

  readonly classes = computed(() =>
    cn('flex flex-col gap-4 p-4 sm:gap-6 sm:p-6', this.class()),
  );
}
