import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { cn } from '../lib/utils';

@Component({
    selector: 'ui-dock-label',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div [class]="classes()">
      <ng-content />
    </div>
  `
})
export class DockLabelComponent {
    class = input<string>('');
    classes = computed(() => cn(
        'absolute -top-10 left-1/2 -translate-x-1/2 hidden px-2 py-0.5 rounded-md border bg-popover text-popover-foreground text-xs shadow-md',
        'group-hover:block',
        this.class()
    ));
}
