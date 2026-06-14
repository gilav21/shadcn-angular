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
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-dock-item',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './dock-item.component.html',
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

    startBounce(): void {
        if (this.isBouncing()) return;
        this.isBouncing.set(true);
        setTimeout(() => this.isBouncing.set(false), 750);
    }

    updateWidth(width: number): void {
        this._renderer.setStyle(this.el.nativeElement, 'width', `${width}px`);
    }

    getCenter(): number {
        const bounds = this.el.nativeElement.getBoundingClientRect();
        return bounds.x + bounds.width / 2;
    }
}
