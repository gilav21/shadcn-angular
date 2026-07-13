import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
    EmojiPickerComponent,
    EmojiPickerTriggerComponent,
    EmojiPickerContentComponent,
} from '@/components/ui/emoji-picker';

/** Harness for the `emoji-picker` component. */
@Component({
    selector: 'app-emoji-picker-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [EmojiPickerComponent, EmojiPickerTriggerComponent, EmojiPickerContentComponent],
    template: `
        <main class="p-8">
            <ui-emoji-picker data-testid="root" (emojiSelect)="picked.set($event)">
                <ui-emoji-picker-trigger data-testid="emoji-picker-trigger">
                    <button type="button">Pick an emoji</button>
                </ui-emoji-picker-trigger>
                <ui-emoji-picker-content data-testid="emoji-picker-content" />
            </ui-emoji-picker>
            <p data-testid="picked">{{ picked() }}</p>
        </main>
    `,
})
export class EmojiPickerDemoComponent {
    readonly picked = signal('');
}
