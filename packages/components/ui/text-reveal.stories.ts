import { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { TextRevealComponent } from './text-reveal.component';

const meta: Meta<TextRevealComponent> = {
    title: 'UI/TextReveal',
    component: TextRevealComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [TextRevealComponent],
        }),
    ],
    argTypes: {
        text: {
            control: 'text',
        },
        delay: {
            control: 'number',
        },
    },
    args: {
        text: 'The quick brown fox jumps over the lazy dog.',
        delay: 50,
    },
};

export default meta;
type Story = StoryObj<TextRevealComponent>;

export const Default: Story = {
    args: {
        text: 'The quick brown fox jumps over the lazy dog.',
    },
    render: (args) => ({
        props: args,
        template: `<ui-text-reveal [text]="text" [delay]="delay" class="text-2xl font-semibold" />`,
    }),
};

export const SlowReveal: Story = {
    args: {
        text: 'Each word appears slowly, one at a time, with a gentle blur animation.',
        delay: 200,
    },
    render: (args) => ({
        props: args,
        template: `<ui-text-reveal [text]="text" [delay]="delay" class="text-xl" />`,
    }),
};

export const FastReveal: Story = {
    args: {
        text: 'This text reveals very quickly with minimal delay between words.',
        delay: 20,
    },
    render: (args) => ({
        props: args,
        template: `<ui-text-reveal [text]="text" [delay]="delay" class="text-lg" />`,
    }),
};

export const LongParagraph: Story = {
    args: {
        text: 'Angular is a platform and framework for building single-page client applications using HTML and TypeScript. Angular is written in TypeScript. It implements core and optional functionality as a set of TypeScript libraries that you import into your applications.',
        delay: 40,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="max-w-2xl">
                <ui-text-reveal [text]="text" [delay]="delay" class="text-base leading-relaxed" />
            </div>
        `,
    }),
};
