import {
    Component,
    computed,
    ElementRef,
    inject,
    input,
    signal,
    ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { cn } from '../lib/utils';
import { DockComponent } from './dock.component';

@Component({
    selector: 'ui-dock-item',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div #ref class="aspect-square w-full h-full flex items-center justify-center relative">
      <ng-content />
      @if (active()) {
        <div class="absolute -bottom-1 w-1 h-1 rounded-full bg-foreground/50"></div>
      }
    </div>
  `,
    host: {
        '[style.width.px]': 'width()',
        '[class]': 'classes()'
    }
})
export class DockItemComponent {
    private dock = inject(DockComponent);
    private el = inject(ElementRef);

    class = input<string>('');
    active = input<boolean>(false);

    // Bounce animation state
    isBouncing = signal(false);

    classes = computed(() => cn(
        'rounded-full cursor-pointer transition-[width,height,margin] duration-100 ease-out relative',
        this.isBouncing() ? 'animate-bounce' : '',
        this.class()
    ));

    startBounce() {
        if (this.isBouncing()) return;
        this.isBouncing.set(true);
        setTimeout(() => this.isBouncing.set(false), 750); // Duration of roughly one bounce cycle
    }

    width = computed(() => {
        const mouseX = this.dock.mouseX();
        const magnification = this.dock.magnification();
        const distance = this.dock.distance();
        const baseWidth = 40;

        if (mouseX === Infinity) {
            return baseWidth;
        }

        const bounds = this.el.nativeElement.getBoundingClientRect();
        const centerX = bounds.x + bounds.width / 2;
        const dist = mouseX - centerX;

        let width = baseWidth;

        if (Math.abs(dist) < distance) {
            const val = Math.abs(dist);
            const weights = Math.cos((val / distance) * (Math.PI / 2));
            // Add scale factor based on weight
            width = baseWidth + (magnification - baseWidth) * weights;
        }

        return width;
    });
}
