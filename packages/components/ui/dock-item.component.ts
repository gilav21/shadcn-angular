import {
    Component,
    ChangeDetectionStrategy,
    computed,
    ElementRef,
    inject,
    input,
    signal,
    Renderer2
} from '@angular/core';
import { cn } from '../lib/utils';

@Component({
    selector: 'ui-dock-item',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [attr.data-slot]="'dock-item'" class="aspect-square w-full h-full flex items-center justify-center relative">
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
    private readonly el = inject(ElementRef);
    private readonly _renderer = inject(Renderer2);

    class = input('');
    active = input<boolean>(false);

    isBouncing = signal(false);

    classes = computed(() => cn(
        'rounded-full cursor-pointer transition-[width,height,margin] duration-100 ease-out relative',
        this.isBouncing() ? 'animate-bounce' : '',
        this.class()
    ));

    startBounce() {
        if (this.isBouncing()) return;
        this.isBouncing.set(true);
        setTimeout(() => this.isBouncing.set(false), 750);
    }

    updateWidth(width: number) {
        this._renderer.setStyle(this.el.nativeElement, 'width', `${width}px`);
    }

    getCenter(): number {
        const bounds = this.el.nativeElement.getBoundingClientRect();
        return bounds.x + bounds.width / 2;
    }
}
