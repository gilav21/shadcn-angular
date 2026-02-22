import { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { TypingAnimationComponent } from './typing-animation.component';

const meta: Meta<TypingAnimationComponent> = {
    title: 'UI/Typing Animation',
    component: TypingAnimationComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [TypingAnimationComponent],
        }),
    ],
    argTypes: {
        typeSpeed: {
            control: 'number',
        },
        deleteSpeed: {
            control: 'number',
        },
        pauseDuration: {
            control: 'number',
        },
        loop: {
            control: 'boolean',
        },
        cursor: {
            control: 'boolean',
        },
    },
    args: {
        typeSpeed: 50,
        deleteSpeed: 30,
        pauseDuration: 1500,
        loop: true,
        cursor: true,
    },
};

export default meta;
type Story = StoryObj<TypingAnimationComponent>;

export const Default: Story = {
    args: {
        strings: ['Hello World', 'Welcome to Angular'],
        typeSpeed: 50,
        deleteSpeed: 30,
        cursor: true,
        loop: true,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="flex items-center justify-center p-12">
                <h2 class="text-4xl font-bold">
                    <ui-typing-animation
                        [strings]="strings"
                        [typeSpeed]="typeSpeed"
                        [deleteSpeed]="deleteSpeed"
                        [cursor]="cursor"
                        [loop]="loop"
                    />
                </h2>
            </div>
        `,
    }),
};

export const NoCursor: Story = {
    args: {
        strings: ['Build beautiful UIs', 'Ship faster than ever', 'With Angular Signals'],
        typeSpeed: 60,
        deleteSpeed: 35,
        cursor: false,
        loop: true,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="flex items-center justify-center p-12">
                <h3 class="text-3xl font-semibold text-primary">
                    <ui-typing-animation
                        [strings]="strings"
                        [typeSpeed]="typeSpeed"
                        [deleteSpeed]="deleteSpeed"
                        [cursor]="cursor"
                        [loop]="loop"
                    />
                </h3>
            </div>
        `,
    }),
};

export const FastTyping: Story = {
    args: {
        strings: ['Lightning fast typing', 'Blazing speed demo', 'Super quick animation'],
        typeSpeed: 20,
        deleteSpeed: 10,
        pauseDuration: 800,
        cursor: true,
        loop: true,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="flex flex-col items-center justify-center p-12 gap-2">
                <h2 class="text-3xl font-bold">
                    <ui-typing-animation
                        [strings]="strings"
                        [typeSpeed]="typeSpeed"
                        [deleteSpeed]="deleteSpeed"
                        [pauseDuration]="pauseDuration"
                        [cursor]="cursor"
                        [loop]="loop"
                    />
                </h2>
                <p class="text-xs text-muted-foreground">typeSpeed={{ typeSpeed }}ms · deleteSpeed={{ deleteSpeed }}ms</p>
            </div>
        `,
    }),
};

export const HeroSection: Story = {
    render: () => ({
        template: `
            <div class="flex flex-col items-center justify-center p-16 gap-4 text-center min-h-48">
                <p class="text-sm text-muted-foreground uppercase tracking-widest">shadcn-angular</p>
                <h1 class="text-5xl font-black min-h-[64px]">
                    <ui-typing-animation
                        [strings]="['Build faster.', 'Ship smarter.', 'Look amazing.', 'Scale effortlessly.']"
                        [typeSpeed]="60"
                        [deleteSpeed]="35"
                        [pauseDuration]="2000"
                        [loop]="true"
                        [cursor]="true"
                    />
                </h1>
                <p class="text-muted-foreground max-w-md">
                    A comprehensive Angular component library with beautiful animations and accessible design.
                </p>
            </div>
        `,
    }),
};

export const CodeEditorStyle: Story = {
    render: () => ({
        template: `
            <div class="p-8 max-w-lg mx-auto">
                <div class="rounded-xl bg-slate-950 p-6 font-mono text-sm">
                    <div class="flex items-center gap-1.5 mb-4">
                        <span class="w-3 h-3 rounded-full bg-red-500"></span>
                        <span class="w-3 h-3 rounded-full bg-yellow-500"></span>
                        <span class="w-3 h-3 rounded-full bg-green-500"></span>
                    </div>
                    <div class="text-slate-400">
                        <span class="text-purple-400">const</span>
                        <span class="text-white"> component </span>
                        <span class="text-slate-400">= </span>
                        <span class="text-green-400">'</span>
                        <span class="text-green-400">
                            <ui-typing-animation
                                [strings]="['ui-button', 'ui-badge', 'ui-card', 'ui-kanban', 'ui-marquee']"
                                [typeSpeed]="80"
                                [deleteSpeed]="50"
                                [pauseDuration]="1200"
                                [loop]="true"
                                [cursor]="true"
                            />
                        </span>
                        <span class="text-green-400">'</span>
                        <span class="text-slate-400">;</span>
                    </div>
                </div>
            </div>
        `,
    }),
};
