import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  ButtonComponent,
  CheckboxComponent,
  EmojiPickerComponent,
  EmojiPickerContentComponent,
  EmojiPickerTriggerComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-emoji-picker-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    CheckboxComponent,
    EmojiPickerComponent,
    EmojiPickerContentComponent,
    EmojiPickerTriggerComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="emoji-picker" class="text-2xl font-semibold scroll-m-20">Emoji Picker</h2>
      <p class="text-muted-foreground">
        A customizable emoji picker with category navigation and search.
      </p>

      <div class="flex items-center gap-4">
        <ui-emoji-picker [closeOnSelect]="closeOnSelect()" (emojiSelect)="onEmojiSelect($event)">
          <ui-emoji-picker-trigger>
            <ui-button variant="outline">Pick an Emoji</ui-button>
          </ui-emoji-picker-trigger>
          <ui-emoji-picker-content />
        </ui-emoji-picker>

        @if (selectedEmoji()) {
        <div class="text-2xl">{{ selectedEmoji() }}</div>
        }

        <div class="flex items-center gap-2 ml-4">
          <ui-checkbox id="closeOnSelect" [checked]="closeOnSelect()" (checkedChange)="closeOnSelect.set($event)" />
          <label for="closeOnSelect"
            class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Close on select
          </label>
        </div>
      </div>
    </section>
  `,
})
export class EmojiPickerDemoComponent {
  readonly selectedEmoji = signal<string | null>(null);
  readonly closeOnSelect = signal(true);

  onEmojiSelect(emoji: string) {
    this.selectedEmoji.set(emoji);
  }
}
