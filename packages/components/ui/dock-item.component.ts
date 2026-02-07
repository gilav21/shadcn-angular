import {
    Component,
    computed,
    ElementRef,
    inject,
    input,
    signal,
    ViewChild,
    Renderer2
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { cn } from '../lib/utils';

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
        '[class]': 'classes()',
        '[style.width.px]': '40'
    }
})
export class DockItemComponent {
    private el = inject(ElementRef);

    class = input<string>('');
    active = input<boolean>(false);

    private _renderer = inject(Renderer2);

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

    public updateWidth(width: number) {
        this._renderer.setStyle(this.el.nativeElement, 'width', `${width}px`);
    }

    public getCenter(): number {
        const bounds = this.el.nativeElement.getBoundingClientRect();
        return bounds.x + bounds.width / 2;
    }
}
