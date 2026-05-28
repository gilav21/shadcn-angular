import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  output,
  signal,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { ButtonComponent } from '../../button';
import { TextareaComponent } from '../../textarea';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'ui-chat-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, TextareaComponent, FormsModule],
  host: { class: 'contents' },
  template: `
    <div [class]="classes()" [attr.data-slot]="'chat-input'">
      <ui-textarea
        [class]="textareaClasses()"
        [placeholder]="placeholder()"
        [(ngModel)]="inputValue"
        (keydown.enter)="onEnter($event)"
        [rows]="1"
      />
      <ui-button
        size="icon"
        aria-label="Send message"
        [disabled]="!inputValue() || disabled()"
        (click)="onSubmit()"
        class="absolute end-2 bottom-2 h-8 w-8"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
            <path d="m5 12 7-7 7 7"/>
            <path d="M12 19V5"/>
        </svg>
      </ui-button>
    </div>
  `,
})
export class ChatInputComponent {
  class = input('');
  placeholder = input('Type a message...');
  disabled = input(false);

  send = output<string>();

  inputValue = signal('');

  classes = computed(() => cn('relative flex items-center', this.class()));
  textareaClasses = computed(() => cn('min-h-[44px] w-full resize-none bg-background pe-12 py-3 rounded-lg border focus-visible:ring-offset-0 focus-visible:ring-1'));

  onEnter(event: Event) {
    const kEvent = event as KeyboardEvent;
    if (!kEvent.shiftKey) {
      event.preventDefault();
      this.onSubmit();
    }
  }

  onSubmit() {
    if (this.inputValue().trim() && !this.disabled()) {
      this.send.emit(this.inputValue());
      this.inputValue.set('');
    }
  }
}
