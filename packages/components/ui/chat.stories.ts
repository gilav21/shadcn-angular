import { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { ChatMessageComponent, ChatListComponent, ChatInputComponent } from './chat.component';

const meta: Meta<ChatMessageComponent> = {
    title: 'UI/Chat',
    component: ChatMessageComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [ChatMessageComponent, ChatListComponent, ChatInputComponent],
        }),
    ],
};

export default meta;
type Story = StoryObj<ChatMessageComponent>;

export const Default: Story = {
    render: () => ({
        props: {
            messages: [
                { role: 'user', content: 'Hey, can you help me with a coding question?', avatarFallback: 'U' },
                { role: 'assistant', content: 'Of course! I\'d be happy to help. What\'s your question?', avatarFallback: 'A' },
                { role: 'system', content: 'Session started' },
            ],
            onSend: (message: string) => {
                console.log('Message sent:', message);
            },
        },
        template: `
            <div class="w-[600px] h-[500px] border rounded-lg flex flex-col">
                <ui-chat-list [autoScroll]="true" class="flex-1">
                    @for (msg of messages; track $index) {
                        <ui-chat-message
                            [role]="msg.role"
                            [content]="msg.content"
                            [avatarFallback]="msg.avatarFallback"
                        />
                    }
                </ui-chat-list>
                <div class="p-4 border-t">
                    <ui-chat-input
                        placeholder="Type a message..."
                        (send)="onSend($event)"
                    />
                </div>
            </div>
        `,
    }),
};

export const UserMessage: Story = {
    render: () => ({
        template: `
            <div class="w-[500px] p-4">
                <ui-chat-message
                    role="user"
                    content="Hello, this is a user message."
                    avatarFallback="U"
                />
            </div>
        `,
    }),
};

export const AssistantMessage: Story = {
    render: () => ({
        template: `
            <div class="w-[500px] p-4">
                <ui-chat-message
                    role="assistant"
                    content="Hello! I'm an assistant. How can I help you today?"
                    avatarFallback="A"
                />
            </div>
        `,
    }),
};

export const SystemMessage: Story = {
    render: () => ({
        template: `
            <div class="w-[500px] p-4">
                <ui-chat-message
                    role="system"
                    content="The conversation has been reset."
                />
            </div>
        `,
    }),
};

export const WithCustomContent: Story = {
    render: () => ({
        template: `
            <div class="w-[500px] p-4">
                <ui-chat-message role="assistant" avatarFallback="A">
                    <div class="space-y-2">
                        <p class="font-semibold">Here's a code example:</p>
                        <pre class="bg-muted p-2 rounded text-xs"><code>const greeting = "Hello, World!";</code></pre>
                    </div>
                </ui-chat-message>
            </div>
        `,
    }),
};

export const DisabledInput: Story = {
    render: () => ({
        template: `
            <div class="w-[500px] p-4">
                <ui-chat-input
                    placeholder="Input is disabled..."
                    [disabled]="true"
                />
            </div>
        `,
    }),
};
