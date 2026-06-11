import {
    Component,
    ChangeDetectionStrategy,
    inject,
} from '@angular/core';
import { EMOJI_PICKER } from '../emoji-picker.component';

@Component({
    selector: 'ui-emoji-picker-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <span
            tabindex="0"
            role="button"
            (click)="onClick($event)"
            (keydown.enter)="onClick($event)"
            (keydown.space)="onClick($event)"
            [attr.data-slot]="'emoji-picker-trigger'"
        >
            <ng-content />
        </span>
    `,
    host: { class: 'contents' },
})
export class EmojiPickerTriggerComponent {
    private readonly picker = inject(EMOJI_PICKER, { optional: true });

    onClick(event: Event): void {
        event.stopPropagation();
        this.picker?.toggle();
    }
}
