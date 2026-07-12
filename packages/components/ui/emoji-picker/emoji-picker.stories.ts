import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { EmojiPickerComponent } from './emoji-picker.component';
import { EmojiPickerTriggerComponent } from './sub/emoji-picker-trigger.component';
import { EmojiPickerContentComponent } from './sub/emoji-picker-content.component';
import { ButtonComponent } from '../button';
import { Component, signal } from '@angular/core';

// The content panel's positioning strategy lives on `ui-emoji-picker-content`,
// not on the main `ui-emoji-picker`; expose it via a story-local props type so
// the Playground can drive it without breaking the typed `args`.
type EmojiPickerStoryProps = EmojiPickerComponent & { strategy: 'absolute' | 'fixed' };

@Component({
    selector: 'emoji-picker-demo',
    imports: [
        EmojiPickerComponent,
        EmojiPickerTriggerComponent,
        EmojiPickerContentComponent,
        ButtonComponent,
    ],
    template: `
        <div class="flex flex-col items-start gap-4">
            <ui-emoji-picker (emojiSelect)="onEmojiSelect($event)">
                <ui-emoji-picker-trigger>
                    <ui-button variant="outline" class="gap-2">
                        <span class="text-lg">{{ selectedEmoji() || '😀' }}</span>
                        Pick an Emoji
                    </ui-button>
                </ui-emoji-picker-trigger>
                <ui-emoji-picker-content />
            </ui-emoji-picker>

            @if (selectedEmoji()) {
                <div class="text-sm text-muted-foreground">
                    Selected: <span class="text-2xl">{{ selectedEmoji() }}</span>
                </div>
            }
        </div>
    `,
})
class EmojiPickerDemoComponent {
    selectedEmoji = signal('');

    onEmojiSelect(emoji: string) {
        this.selectedEmoji.set(emoji);
    }
}

@Component({
    selector: 'emoji-picker-custom-trigger-demo',
    imports: [
        EmojiPickerComponent,
        EmojiPickerTriggerComponent,
        EmojiPickerContentComponent,
    ],
    template: `
        <ui-emoji-picker (emojiSelect)="onEmojiSelect($event)">
            <ui-emoji-picker-trigger>
                <button
                    class="size-10 rounded-full bg-linear-to-br from-pink-500 to-violet-500 flex items-center justify-center text-xl shadow-lg hover:scale-110 transition-transform cursor-pointer"
                >
                    {{ selectedEmoji() || '✨' }}
                </button>
            </ui-emoji-picker-trigger>
            <ui-emoji-picker-content />
        </ui-emoji-picker>
    `,
})
class EmojiPickerCustomTriggerDemoComponent {
    selectedEmoji = signal('');

    onEmojiSelect(emoji: string) {
        this.selectedEmoji.set(emoji);
    }
}

@Component({
    selector: 'emoji-reaction-bar-demo',
    imports: [
        EmojiPickerComponent,
        EmojiPickerTriggerComponent,
        EmojiPickerContentComponent,
    ],
    template: `
        <div class="p-4 rounded-lg border bg-card">
            <p class="text-sm mb-3">This is a sample message that you can react to!</p>
            <div class="flex items-center gap-1">
                @for (emoji of reactions(); track $index) {
                    <span class="px-2 py-1 rounded-full bg-muted text-sm cursor-pointer hover:bg-accent transition-colors">
                        {{ emoji }}
                    </span>
                }
                <ui-emoji-picker (emojiSelect)="addReaction($event)">
                    <ui-emoji-picker-trigger>
                        <button
                            class="size-7 rounded-full border border-dashed border-muted-foreground/50 flex items-center justify-center text-muted-foreground hover:bg-accent hover:border-solid transition-all cursor-pointer"
                        >
                            +
                        </button>
                    </ui-emoji-picker-trigger>
                    <ui-emoji-picker-content />
                </ui-emoji-picker>
            </div>
        </div>
    `,
})
class EmojiReactionBarDemoComponent {
    reactions = signal<string[]>(['👍', '❤️']);

    addReaction(emoji: string) {
        this.reactions.update(r => [...r, emoji]);
    }
}

const meta: Meta<EmojiPickerStoryProps> = {
    title: 'UI/Emoji Picker',
    component: EmojiPickerComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                EmojiPickerComponent,
                EmojiPickerTriggerComponent,
                EmojiPickerContentComponent,
                ButtonComponent,
                EmojiPickerDemoComponent,
                EmojiPickerCustomTriggerDemoComponent,
                EmojiReactionBarDemoComponent,
            ],
        }),
    ],
    argTypes: {
        open: { control: 'boolean', description: 'Two-way bindable open state of the picker popover.' },
        closeOnSelect: { control: 'boolean', description: 'Closes the picker automatically after an emoji is selected.' },
        closeOnScroll: { control: 'boolean', description: 'Closes the picker when the page scrolls outside of it.' },
        strategy: {
            control: 'select',
            options: ['absolute', 'fixed'],
            description: 'Positioning strategy of the content panel, owned by ui-emoji-picker-content.',
        },
    },
    args: {
        open: false,
        closeOnSelect: true,
        closeOnScroll: false,
        strategy: 'absolute',
    },
};

export default meta;
type Story = StoryObj<EmojiPickerStoryProps>;

const TEMPLATE = `
    <div class="flex flex-col items-start gap-4">
        <ui-emoji-picker
            [open]="open"
            [closeOnSelect]="closeOnSelect"
            [closeOnScroll]="closeOnScroll"
            (emojiSelect)="selectedEmoji = $event"
        >
            <ui-emoji-picker-trigger>
                <ui-button variant="outline" class="gap-2">
                    <span class="text-lg">{{ selectedEmoji || '😀' }}</span>
                    Pick an Emoji
                </ui-button>
            </ui-emoji-picker-trigger>
            <ui-emoji-picker-content [strategy]="strategy" />
        </ui-emoji-picker>
        @if (selectedEmoji) {
            <div class="text-sm text-muted-foreground">
                Selected: <span class="text-2xl">{{ selectedEmoji }}</span>
            </div>
        }
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: { ...args, selectedEmoji: '' },
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = {
    render: () => ({
        template: `<emoji-picker-demo />`,
    }),
};

export const CustomTrigger: Story = {
    render: () => ({
        template: `<emoji-picker-custom-trigger-demo />`,
    }),
};

export const ReactionBar: Story = {
    render: () => ({
        template: `<emoji-reaction-bar-demo />`,
    }),
};

export const FixedStrategy: Story = {
    args: { strategy: 'fixed' },
    render,
};

export const CloseOnScroll: Story = {
    args: { closeOnScroll: true },
    render,
};

export const KeepOpenOnSelect: Story = {
    args: { closeOnSelect: false },
    render,
};
