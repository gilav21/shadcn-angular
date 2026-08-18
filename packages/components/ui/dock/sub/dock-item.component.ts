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

    /** Extra classes merged onto the item host. Avoid `w-*` here — width is owned by the dock's hover magnification and written as an inline style. Add `group` if you project a `ui-dock-label`, which reveals itself on `group-hover`. */
    class = input('');
    /** Shows the small "running" dot under the icon. Presentational only — it neither highlights the item nor is tracked by the dock. */
    active = input<boolean>(false);

    isBouncing = signal(false);

    classes = computed(() => cn(
        'rounded-full cursor-pointer transition-[width,height,margin] duration-100 ease-out relative',
        this.isBouncing() ? 'animate-bounce' : '',
        this.class()
    ));

    /** Plays the 750ms macOS-style bounce, e.g. to acknowledge a launch. Ignored while a bounce is already running, so repeated calls do not stack or restart it. */
    startBounce(): void {
        if (this.isBouncing()) return;
        this.isBouncing.set(true);
        setTimeout(() => this.isBouncing.set(false), 750);
    }

    /** Sets the item's width in px. Called by the parent dock on every animation frame of a hover; it writes the style directly, outside change detection, so nothing here is signal-backed. */
    updateWidth(width: number): void {
        this._renderer.setStyle(this.el.nativeElement, 'width', `${width}px`);
    }

    /**
     * The item's centre in viewport coordinates along `axis`, which the dock
     * caches to measure cursor distance — `'x'` for a horizontal dock, `'y'` for
     * a vertical one. Live layout read: it reflects the item's *current*
     * magnified size, so it must be sampled at rest.
     */
    getCenter(axis: 'x' | 'y' = 'x'): number {
        const bounds = this.el.nativeElement.getBoundingClientRect();
        return axis === 'y'
            ? bounds.y + bounds.height / 2
            : bounds.x + bounds.width / 2;
    }
}
