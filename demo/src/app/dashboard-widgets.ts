import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent, CardContentComponent, CardHeaderComponent, CardTitleComponent } from '../../../packages/components/ui/card.component';
import { CalendarComponent } from '../../../packages/components/ui/calendar';
import { AvatarComponent, AvatarImageComponent, AvatarFallbackComponent } from '../../../packages/components/ui/avatar';
import { BadgeComponent } from '../../../packages/components/ui/badge';
import { ButtonComponent } from '../../../packages/components/ui/button';

@Component({
  selector: 'demo-metric-widget',
  standalone: true,
  imports: [CommonModule, CardComponent, CardContentComponent, CardHeaderComponent, CardTitleComponent],
  template: `
    <ui-card class="h-full border-none shadow-none bg-transparent">
      <ui-card-header class="pb-2">
        <ui-card-title class="text-sm font-medium text-muted-foreground">{{ title() }}</ui-card-title>
      </ui-card-header>
      <ui-card-content>
        <div class="text-2xl font-bold">{{ value() }}</div>
        <p class="text-xs text-muted-foreground mt-1">
          <span [class.text-green-500]="trend() > 0" [class.text-red-500]="trend() < 0">
            {{ trend() > 0 ? '+' : '' }}{{ trend() }}%
          </span> from last month
        </p>
      </ui-card-content>
    </ui-card>
  `
})
export class MetricWidgetComponent {
  title = input.required<string>();
  value = input.required<string>();
  trend = input.required<number>();
}

@Component({
  selector: 'demo-calendar-widget',
  standalone: true,
  imports: [CommonModule, CalendarComponent, CardComponent, CardContentComponent],
  template: `
    <ui-card class="h-full border-none shadow-none bg-transparent flex flex-col">
      <ui-card-content class="p-0 flex-1 flex items-center justify-center">
        <ui-calendar class="rounded-md border p-1 scale-90 origin-top-left" />
      </ui-card-content>
    </ui-card>
  `
})
export class CalendarWidgetComponent { }

@Component({
  selector: 'demo-team-widget',
  standalone: true,
  imports: [CommonModule, CardComponent, CardHeaderComponent, CardTitleComponent, CardContentComponent, AvatarComponent, AvatarImageComponent, AvatarFallbackComponent],
  template: `
    <ui-card class="h-full border-none shadow-none bg-transparent">
      <ui-card-header>
        <ui-card-title class="text-base">Team Members</ui-card-title>
      </ui-card-header>
      <ui-card-content>
        <div class="flex flex-col gap-4">
          @for (member of members; track member.name) {
            <div class="flex items-center gap-4">
              <ui-avatar>
                <ui-avatar-image [src]="member.image" />
                <ui-avatar-fallback>{{ member.initials }}</ui-avatar-fallback>
              </ui-avatar>
              <div class="flex flex-col">
                <span class="text-sm font-medium">{{ member.name }}</span>
                <span class="text-xs text-muted-foreground">{{ member.role }}</span>
              </div>
            </div>
          }
        </div>
      </ui-card-content>
    </ui-card>
  `
})
export class TeamWidgetComponent {
  members = [
    { name: 'Sofia Davis', role: 'Owner', image: 'https://github.com/shadcn.png', initials: 'SD' },
    { name: 'Jackson Lee', role: 'Member', image: 'https://github.com/shadcn.png', initials: 'JL' },
  ];
}

@Component({
  selector: 'demo-activity-widget',
  standalone: true,
  imports: [CommonModule, CardComponent, CardHeaderComponent, CardTitleComponent, CardContentComponent, BadgeComponent],
  template: `
    <ui-card class="h-full border-none shadow-none bg-transparent">
      <ui-card-header>
        <ui-card-title class="text-base">Recent Activity</ui-card-title>
      </ui-card-header>
      <ui-card-content>
        <div class="space-y-4">
          @for (item of items; track item.id) {
            <div class="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                <div class="space-y-1">
                    <p class="text-sm font-medium">{{ item.action }}</p>
                    <p class="text-xs text-muted-foreground">{{ item.time }}</p>
                </div>
                <ui-badge variant="secondary">{{ item.status }}</ui-badge>
            </div>
          }
        </div>
      </ui-card-content>
    </ui-card>
  `
})
export class ActivityWidgetComponent {
  items = [
    { id: 1, action: 'Project Created', time: '2 hours ago', status: 'Success' },
    { id: 2, action: 'Task Assigned', time: '4 hours ago', status: 'Pending' },
    { id: 3, action: 'Meeting', time: 'Yesterday', status: 'Done' },
  ]
}

@Component({
  selector: 'demo-action-widget',
  standalone: true,
  imports: [CommonModule, CardComponent, CardHeaderComponent, CardTitleComponent, CardContentComponent, ButtonComponent],
  template: `
    <ui-card class="h-full border-none shadow-none bg-transparent">
      <ui-card-header>
        <ui-card-title class="text-base">Quick Actions</ui-card-title>
      </ui-card-header>
      <ui-card-content>
        <div class="flex flex-col gap-2">
            <ui-button (click)="performAction('refresh')" variant="outline" size="sm">Refresh Data</ui-button>
            <ui-button (click)="performAction('export')" variant="outline" size="sm">Export Report</ui-button>
        </div>
      </ui-card-content>
    </ui-card>
  `
})
export class ActionWidgetComponent {
  action = output<string>();

  performAction(actionType: string) {
    this.action.emit(actionType);
  }
}
