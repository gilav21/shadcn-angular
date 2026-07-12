import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { StreamingTextComponent } from './streaming-text.component';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct mode.
const meta: Meta<StreamingTextComponent> = {
    title: 'UI/Streaming Text',
    component: StreamingTextComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [StreamingTextComponent],
        }),
    ],
    argTypes: {
        text: {
            control: 'text',
            description: 'Text to type out character by character.',
        },
        speed: {
            control: 'number',
            description: 'Milliseconds per character.',
        },
        showCursor: {
            control: 'boolean',
            description: 'Shows a blinking cursor while typing.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the host span.' },
    },
    args: {
        text: 'This text streams in character by character, like an AI response.',
        speed: 30,
        showCursor: true,
        class: '',
    },
};

export default meta;
type Story = StoryObj<StreamingTextComponent>;

const TEMPLATE = `<ui-streaming-text [text]="text" [speed]="speed" [showCursor]="showCursor" [class]="class" />`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `<p class="text-base"><ui-streaming-text [text]="text" [speed]="speed" [showCursor]="showCursor" [class]="class" /></p>`,
    }),
};

export const FastTyping: Story = {
    args: {
        text: 'Fast typing feels almost instant.',
        speed: 10,
    },
    render,
};

export const SlowTyping: Story = {
    args: {
        text: 'Slow, deliberate typing draws attention to each word.',
        speed: 90,
    },
    render,
};

export const NoCursor: Story = {
    args: {
        showCursor: false,
    },
    render,
};

export const LongParagraph: Story = {
    args: {
        text: 'Angular is a platform and framework for building single-page client applications using HTML and TypeScript. Streaming text is often used to simulate AI assistant responses arriving token by token.',
        speed: 15,
        class: 'max-w-2xl block',
    },
    render,
};
