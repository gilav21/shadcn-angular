import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
    ChatMessageComponent,
    ChatListComponent,
    ChatInputComponent,
} from '@/components/ui/chat';

/**
 * Harness for the `chat` component. Note the barrel has no `ui-chat`
 * element — `chat.component.ts` declares `ui-chat-message`.
 */
@Component({
    selector: 'app-chat-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ChatMessageComponent, ChatListComponent, ChatInputComponent],
    template: `
        <main class="p-8">
            <ui-chat-list data-testid="root" class="block">
                @for (m of messages(); track $index) {
                    <ui-chat-message [role]="m.role" [content]="m.text" avatarFallback="U" />
                }
            </ui-chat-list>
            <ui-chat-input data-testid="chat-input" (send)="onSend($event)" />
        </main>
    `,
})
export class ChatDemoComponent {
    readonly messages = signal<{ role: 'user' | 'assistant'; text: string }[]>([
        { role: 'assistant', text: 'How can I help?' },
    ]);

    onSend(text: string): void {
        this.messages.update(list => [...list, { role: 'user', text }]);
    }
}
