import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import {
  ButtonComponent,
  CheckboxComponent,
  EmojiPickerComponent,
  EmojiPickerContentComponent,
  EmojiPickerTriggerComponent,
} from '../../../../../packages/components/ui';
import { EMOJI_PICKER_DEMO_LOCALES } from './emoji-picker-demo.locales';

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
      <h2 id="emoji-picker" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="flex items-center gap-4">
        <ui-emoji-picker [closeOnSelect]="closeOnSelect()" (emojiSelect)="onEmojiSelect($event)">
          <ui-emoji-picker-trigger>
            <ui-button variant="outline">{{ t().triggerLabel }}</ui-button>
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
            {{ t().closeOnSelectLabel }}
          </label>
        </div>
      </div>
    </section>
  `,
})
export class EmojiPickerDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => EMOJI_PICKER_DEMO_LOCALES[this.localeId()] ?? EMOJI_PICKER_DEMO_LOCALES['en']);

  readonly selectedEmoji = signal<string | null>(null);
  readonly closeOnSelect = signal(true);

  onEmojiSelect(emoji: string): void {
    this.selectedEmoji.set(emoji);
  }
}
