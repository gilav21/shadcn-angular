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
        strings: { control: 'object', description: 'Sequence of strings to type and delete in a loop.' },
        typeSpeed: { control: 'number', description: 'Milliseconds between each typed character.' },
        deleteSpeed: { control: 'number', description: 'Milliseconds between each deleted character.' },
        pauseDuration: { control: 'number', description: 'Milliseconds to pause after a string is fully typed.' },
        loop: { control: 'boolean', description: 'Restarts from the first string after the last one finishes.' },
        cursor: { control: 'boolean', description: 'Shows a blinking cursor.' },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        strings: ['Hello World', 'Welcome to Angular'],
        typeSpeed: 50,
        deleteSpeed: 30,
        pauseDuration: 1500,
        loop: true,
        cursor: true,
        class: '',
    },
};

export default meta;
type Story = StoryObj<TypingAnimationComponent>;

const TEMPLATE = `
    <div class="flex items-center justify-center p-12">
        <h2 class="text-4xl font-bold">
            <ui-typing-animation
                [strings]="strings"
                [typeSpeed]="typeSpeed"
                [deleteSpeed]="deleteSpeed"
                [pauseDuration]="pauseDuration"
                [cursor]="cursor"
                [loop]="loop"
                [class]="class"
            />
        </h2>
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = { render };

export const NoCursor: Story = {
    args: {
        strings: ['Build beautiful UIs', 'Ship faster than ever', 'With Angular Signals'],
        typeSpeed: 60,
        deleteSpeed: 35,
        cursor: false,
        loop: true,
    },
    render,
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
                        [class]="class"
                    />
                </h2>
                <p class="text-xs text-muted-foreground">typeSpeed={{ typeSpeed }}ms · deleteSpeed={{ deleteSpeed }}ms</p>
            </div>
        `,
    }),
};

export const NoLoop: Story = {
    args: {
        strings: ['Types once and stops.'],
        loop: false,
    },
    render,
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
