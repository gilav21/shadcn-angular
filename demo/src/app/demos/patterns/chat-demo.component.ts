import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import {
  ChatMessageComponent,
  ChatListComponent,
  ChatInputComponent,
  StreamingTextComponent,
} from '../../../../../packages/components/ui';
import { CHAT_DEMO_LOCALES } from './chat-demo.locales';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  role: ChatRole;
  content: string;
}

@Component({
  selector: 'app-chat-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ChatMessageComponent,
    ChatListComponent,
    ChatInputComponent,
    StreamingTextComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="chat" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="border rounded-md w-full max-w-md h-[400px] flex flex-col overflow-hidden">
        <ui-chat-list class="flex-1" [autoScroll]="true">
          @for (msg of chatMessages(); track $index) {
          <ui-chat-message [role]="msg.role" [avatarFallback]="msg.role === 'assistant' ? 'AI' : 'ME'">
            @if (msg.role === 'assistant') {
            <ui-streaming-text [text]="msg.content" />
            } @else {
            {{ msg.content }}
            }
          </ui-chat-message>
          }
        </ui-chat-list>
        <div class="p-4 border-t bg-muted/20">
          <ui-chat-input (send)="onChatSend($event)" />
        </div>
      </div>
    </section>
  `,
})
export class ChatDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  private readonly destroyRef = inject(DestroyRef);
  private activeInterval: ReturnType<typeof setInterval> | null = null;

  protected readonly t = computed(
    () => CHAT_DEMO_LOCALES[this.localeId()] ?? CHAT_DEMO_LOCALES['en'],
  );

  readonly chatMessages = signal<ChatMessage[]>([
    { role: 'assistant', content: this.t().initialMessage },
  ]);

  constructor() {
    let prev = this.t();
    effect(() => {
      const next = this.t();
      if (next !== prev) {
        this.chatMessages.set([{ role: 'assistant', content: next.initialMessage }]);
        prev = next;
      }
    });

    this.destroyRef.onDestroy(() => {
      if (this.activeInterval) {
        clearInterval(this.activeInterval);
      }
    });
  }

  onChatSend(message: string) {
    this.chatMessages.update(msgs => [...msgs, { role: 'user', content: message }]);
    const response = this.t().simulatedResponse;
    setTimeout(() => {
      this.chatMessages.update(msgs => [...msgs, { role: 'assistant', content: '' }]);

      let i = 0;
      this.activeInterval = setInterval(() => {
        if (i < response.length) {
          this.chatMessages.update(msgs => {
            const newMsgs = [...msgs];
            const lastMsg = newMsgs.at(-1);
            if (lastMsg?.role !== 'assistant') return newMsgs;
            newMsgs[newMsgs.length - 1] = { ...lastMsg, content: lastMsg.content + response[i] };
            return newMsgs;
          });
          i++;
        } else if (this.activeInterval) {
          clearInterval(this.activeInterval);
          this.activeInterval = null;
        }
      }, 30);
    }, 1000);
  }
}
