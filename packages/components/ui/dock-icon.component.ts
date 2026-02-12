import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { cn } from '../lib/utils';

@Component({
    selector: 'ui-dock-icon',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div [class]="classes()">
      <ng-content />
    </div>
  `
})
export class DockIconComponent {
    class = input<string>('');
    classes = computed(() => cn('size-full flex items-center justify-center', this.class()));
}
