import { BadgeComponent } from '@/components/ui';
import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

@Component({
    selector: 'app-status-cell',
    standalone: true,
    template: `
    <ui-badge [variant]="badgeVariant()">
      {{ status() }}
    </ui-badge>
  `,
    imports: [BadgeComponent],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatusCellComponent {
    status = input.required<string>();

    badgeVariant = computed(() => {
        const s = this.status();
        if (s === 'success') return 'default';
        if (s === 'processing') return 'secondary';
        if (s === 'pending') return 'outline';
        return 'destructive';
    });
}
