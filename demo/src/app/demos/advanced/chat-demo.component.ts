import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import {
  ChatMessageComponent,
  ChatListComponent,
  ChatInputComponent,
  StreamingTextComponent,
} from '../../../../../packages/components/ui';

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
      <h2 id="chat" class="text-2xl font-semibold scroll-m-20">Chat</h2>
      <p class="text-muted-foreground">Conversational UI components.</p>

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
  private readonly destroyRef = inject(DestroyRef);
  private activeInterval: ReturnType<typeof setInterval> | null = null;

  readonly chatMessages = signal<ChatMessage[]>([
    { role: 'assistant', content: 'Hello! How can I help you today?' }
  ]);

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.activeInterval) {
        clearInterval(this.activeInterval);
      }
    });
  }

  onChatSend(message: string) {
    this.chatMessages.update(msgs => [...msgs, { role: 'user', content: message }]);
    setTimeout(() => {
      const response = 'I am a simulated AI response. I am streaming this text to demonstrate the real-time capabilities.';

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
