import { Meta, StoryObj } from '@storybook/angular';
import {
    EmojiPickerComponent,
    EmojiPickerTriggerComponent,
    EmojiPickerContentComponent,
} from './emoji-picker.component';
import { ButtonComponent } from './button.component';
import { moduleMetadata } from '@storybook/angular';
import { Component, signal } from '@angular/core';

// Demo component to show emoji selection
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

// Custom trigger demo
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

// Emoji reaction bar demo
@Component({
    selector: 'emoji-reaction-bar-demo',
    imports: [
        EmojiPickerComponent,
        EmojiPickerTriggerComponent,
        EmojiPickerContentComponent,
        ButtonComponent,
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

const meta: Meta<EmojiPickerComponent> = {
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
};

export default meta;
type Story = StoryObj<EmojiPickerComponent>;

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
