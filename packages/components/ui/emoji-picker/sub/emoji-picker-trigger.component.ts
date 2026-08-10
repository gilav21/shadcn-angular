import {
    Component,
    ChangeDetectionStrategy,
    ElementRef,
    afterNextRender,
    inject,
    signal,
} from '@angular/core';
import { EMOJI_PICKER } from '../emoji-picker.component';
import { hasInteractiveContent } from '../../../lib/a11y';

@Component({
    selector: 'ui-emoji-picker-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <span
            [attr.tabindex]="wrapsInteractive() ? null : 0"
            [attr.role]="wrapsInteractive() ? null : 'button'"
            (click)="onClick($event)"
            (keydown.enter)="onKeydown($event)"
            (keydown.space)="onKeydown($event)"
            [attr.data-slot]="'emoji-picker-trigger'"
        >
            <ng-content />
        </span>
    `,
    host: { class: 'contents' },
})
export class EmojiPickerTriggerComponent {
    private readonly picker = inject(EMOJI_PICKER, { optional: true });
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

    /** See `lib/a11y.ts` — stays transparent when the projected content is already a control. */
    readonly wrapsInteractive = signal(false);

    constructor() {
        afterNextRender(() => {
            this.wrapsInteractive.set(hasInteractiveContent(this.host.nativeElement));
        });
    }

    /**
     * Toggles the parent picker and stops propagation, so the picker's own
     * document-click dismissal does not immediately undo the open.
     */
    onClick(event: Event): void {
        event.stopPropagation();
        this.picker?.toggle();
    }

    /**
     * `Enter`/`Space` activation for the synthesized button. Ignores keys that bubbled
     * from projected content — when {@link wrapsInteractive} is true that inner control
     * fires its own click, and handling both would toggle twice. `preventDefault()`
     * keeps `Space` from scrolling the page.
     */
    onKeydown(event: Event): void {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        this.onClick(event);
    }
}
