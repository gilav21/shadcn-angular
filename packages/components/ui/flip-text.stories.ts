import { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { FlipTextComponent } from './flip-text.component';

const meta: Meta<FlipTextComponent> = {
    title: 'UI/Flip Text',
    component: FlipTextComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [FlipTextComponent],
        }),
    ],
    argTypes: {
        text: {
            control: 'text',
        },
        delay: {
            control: 'number',
        },
        duration: {
            control: 'number',
        },
    },
    args: {
        text: 'Hello World',
        delay: 50,
        duration: 500,
    },
};

export default meta;
type Story = StoryObj<FlipTextComponent>;

export const Default: Story = {
    args: {
        text: 'Hello World',
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="flex items-center justify-center p-12">
                <ui-flip-text [text]="text" [delay]="delay" [duration]="duration" class="text-5xl font-bold" />
            </div>
        `,
    }),
};

export const LongText: Story = {
    args: {
        text: 'The quick brown fox jumps over the lazy dog',
        delay: 30,
        duration: 400,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="flex items-center justify-center p-12 max-w-2xl">
                <ui-flip-text [text]="text" [delay]="delay" [duration]="duration" class="text-2xl font-semibold" />
            </div>
        `,
    }),
};

export const FastAnimation: Story = {
    args: {
        text: 'Lightning Fast',
        delay: 25,
        duration: 200,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="flex flex-col items-center gap-4 p-12">
                <ui-flip-text [text]="text" [delay]="delay" [duration]="duration" class="text-4xl font-black tracking-tight" />
                <p class="text-sm text-muted-foreground">delay={{ delay }}ms, duration={{ duration }}ms</p>
            </div>
        `,
    }),
};

export const HeroTitle: Story = {
    render: () => ({
        template: `
            <div class="flex flex-col items-center gap-6 p-16 bg-background">
                <ui-flip-text text="Welcome to" class="text-2xl text-muted-foreground font-light" [delay]="40" />
                <ui-flip-text text="shadcn-angular" class="text-6xl font-black text-primary" [delay]="60" [duration]="600" />
                <ui-flip-text text="Build faster. Ship smarter." class="text-lg text-muted-foreground" [delay]="25" [duration]="350" />
            </div>
        `,
    }),
};
