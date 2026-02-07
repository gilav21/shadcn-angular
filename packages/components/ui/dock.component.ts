import {
    Component,
    computed,
    signal,
    ViewEncapsulation,
    input
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { cva, VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';
import { DockItemComponent } from './dock-item.component';
import { DockIconComponent } from './dock-icon.component';
import { DockLabelComponent } from './dock-label.component';

const dockVariants = cva(
    'mx-auto w-max mt-8 h-[58px] p-2 flex gap-2 rounded-2xl border supports-backdrop-blur:bg-white/10 supports-backdrop-blur:dark:bg-black/10 backdrop-blur-md',
    {
        variants: {
            position: {
                bottom: 'items-end',
                top: 'items-start',
                left: 'items-start flex-col',
                right: 'items-start flex-col',
            },
        },
        defaultVariants: {
            position: 'bottom',
        },
    }
);

export interface DockItemData {
    label?: string;
    icon?: string;
    class?: string;
    active?: boolean;
}

@Component({
    selector: 'ui-dock',
    standalone: true,
    imports: [CommonModule, DockItemComponent, DockIconComponent, DockLabelComponent],
    template: `
    <div
      #dock
      [class]="classes()"
      (mousemove)="onMouseMove($event)"
      (mouseleave)="onMouseLeave()"
    >
      <ng-content />
      @for (item of items(); track $index) {
        <ui-dock-item [class]="item.class || ''" [active]="item.active || false">
           @if (item.label) { <ui-dock-label>{{ item.label }}</ui-dock-label> }
           @if (item.icon) { <ui-dock-icon>{{ item.icon }}</ui-dock-icon> }
        </ui-dock-item>
      }
    </div>
  `,
    host: {
        'class': 'block w-full'
    },
    encapsulation: ViewEncapsulation.None
})
export class DockComponent {
    class = input<string>('');
    magnification = input<number>(60);
    distance = input<number>(100);
    position = input<'bottom' | 'top' | 'left' | 'right'>('bottom');
    items = input<DockItemData[]>([]);

    mouseX = signal<number>(Infinity);

    classes = computed(() => cn(dockVariants({ position: this.position() }), this.class()));

    onMouseMove(e: MouseEvent) {
        this.mouseX.set(e.clientX);
    }

    onMouseLeave() {
        this.mouseX.set(Infinity);
    }
}
