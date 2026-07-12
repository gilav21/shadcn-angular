import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { ChatMessageComponent, ChatListComponent, ChatInputComponent } from './index';

// `meta.component` is the ChatMessageComponent so its inputs surface in the
// Controls panel; the Playground binds all of them. The list + input
// sub-components are made available via moduleMetadata so the compound-mode
// stories can compose a full chat window. `ui-chat-input`'s
// `placeholder`/`disabled` and `ui-chat-list`'s `autoScroll` are real inputs
// too, surfaced here as extra argTypes and wired into the stories that
// actually render those sub-components (Conversation, DisabledInput).
type ChatStoryProps = ChatMessageComponent & {
    inputPlaceholder: string;
    inputDisabled: boolean;
    listAutoScroll: boolean;
};

const meta: Meta<ChatStoryProps> = {
    title: 'UI/Chat',
    component: ChatMessageComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [ChatMessageComponent, ChatListComponent, ChatInputComponent],
        }),
    ],
    argTypes: {
        role: {
            control: 'select',
            options: ['user', 'assistant', 'system'],
            description: 'Who authored the message; drives alignment, colors and avatar visibility.',
        },
        content: { control: 'text', description: 'Simple-mode text shown when no content is projected.' },
        avatarSrc: { control: 'text', description: 'Avatar image URL; falls back to the initials when unset.' },
        avatarFallback: { control: 'text', description: 'Avatar fallback text (usually initials).' },
        class: { control: 'text', description: 'Extra classes merged onto the message root.' },
        inputPlaceholder: { control: 'text', description: '`ui-chat-input` placeholder text.' },
        inputDisabled: { control: 'boolean', description: '`ui-chat-input` disabled state; blocks sending.' },
        listAutoScroll: { control: 'boolean', description: '`ui-chat-list` auto-scrolls to the bottom when new messages are appended.' },
    },
    args: {
        role: 'assistant',
        content: 'Hello! How can I help you today?',
        avatarSrc: undefined,
        avatarFallback: 'A',
        class: '',
        inputPlaceholder: 'Type a message...',
        inputDisabled: false,
        listAutoScroll: true,
    },
};

export default meta;
type Story = StoryObj<ChatStoryProps>;

const TEMPLATE = `
    <div class="w-[500px] p-4">
        <ui-chat-message
            [role]="role" [content]="content" [avatarSrc]="avatarSrc"
            [avatarFallback]="avatarFallback" [class]="class" />
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every ChatMessage input is wired to the Controls panel. */
export const Playground: Story = { render };

export const UserMessage: Story = {
    args: { role: 'user', content: 'Hello, this is a user message.', avatarFallback: 'U' },
    render,
};

export const AssistantMessage: Story = {
    args: { role: 'assistant', content: 'Hello! I\'m an assistant. How can I help you today?', avatarFallback: 'A' },
    render,
};

export const SystemMessage: Story = {
    args: { role: 'system', content: 'The conversation has been reset.' },
    render,
};

/** Custom projected content overrides the simple `content` input. */
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
            </div>`,
    }),
};

/** Full compound mode: scrollable list of messages plus an input bar. */
export const Conversation: Story = {
    render: (args) => ({
        props: {
            ...args,
            messages: [
                { role: 'user', content: 'Hey, can you help me with a coding question?', avatarFallback: 'U' },
                { role: 'assistant', content: 'Of course! I\'d be happy to help. What\'s your question?', avatarFallback: 'A' },
                { role: 'system', content: 'Session started' },
            ],
            onSend: (_message: string) => {
                // message handled by consumer
            },
        },
        template: `
            <div class="w-[600px] h-[500px] border rounded-lg flex flex-col">
                <ui-chat-list [autoScroll]="listAutoScroll" class="flex-1">
                    @for (msg of messages; track $index) {
                        <ui-chat-message
                            [role]="msg.role"
                            [content]="msg.content"
                            [avatarFallback]="msg.avatarFallback" />
                    }
                </ui-chat-list>
                <div class="p-4 border-t">
                    <ui-chat-input [placeholder]="inputPlaceholder" [disabled]="inputDisabled" (send)="onSend($event)" />
                </div>
            </div>`,
    }),
};

/** Input bar with sending disabled. */
export const DisabledInput: Story = {
    args: { inputPlaceholder: 'Input is disabled...', inputDisabled: true },
    render: (args) => ({
        props: args,
        template: `
            <div class="w-[500px] p-4">
                <ui-chat-input [placeholder]="inputPlaceholder" [disabled]="inputDisabled" />
            </div>`,
    }),
};
