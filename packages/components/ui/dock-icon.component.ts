import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { cn } from '../lib/utils';

@Component({
    selector: 'ui-dock-icon',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'dock-icon'">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class DockIconComponent {
    class = input('');
    classes = computed(() => cn('size-full flex items-center justify-center', this.class()));
}
