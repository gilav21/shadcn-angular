import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { MorphingTextComponent } from './morphing-text.component';

const meta: Meta<MorphingTextComponent> = {
    title: 'UI/Morphing Text',
    component: MorphingTextComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [MorphingTextComponent],
        }),
    ],
    argTypes: {
        interval: {
            control: 'number',
        },
        texts: {
            control: 'object',
        },
    },
    args: {
        interval: 3000,
        texts: ['Innovation', 'Technology', 'Future'],
    },
};

export default meta;
type Story = StoryObj<MorphingTextComponent>;

export const Default: Story = {
    args: {
        texts: ['Innovation', 'Technology', 'Future'],
        interval: 3000,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="flex items-center justify-center p-16">
                <h1 class="text-6xl font-black">
                    <ui-morphing-text [texts]="texts" [interval]="interval" />
                </h1>
            </div>
        `,
    }),
};

export const FastMorph: Story = {
    args: {
        texts: ['Angular', 'TypeScript', 'Signals', 'Components'],
        interval: 1500,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="flex items-center justify-center p-16">
                <h2 class="text-5xl font-bold text-primary">
                    <ui-morphing-text [texts]="texts" [interval]="interval" />
                </h2>
            </div>
        `,
    }),
};

export const HeroHeadline: Story = {
    render: () => ({
        template: `
            <div class="flex flex-col items-center justify-center p-16 text-center gap-4">
                <p class="text-sm text-muted-foreground uppercase tracking-widest">Powered by</p>
                <h1 class="text-7xl font-black">
                    <ui-morphing-text
                        [texts]="['Simplicity', 'Elegance', 'Performance', 'Accessibility']"
                        [interval]="2500"
                    />
                </h1>
                <p class="text-muted-foreground max-w-sm">
                    Each word fades and blurs into the next, creating a seamless morphing transition effect.
                </p>
            </div>
        `,
    }),
};

export const SubtleVariant: Story = {
    render: () => ({
        template: `
            <div class="p-10 space-y-8">
                <div class="flex items-baseline gap-2">
                    <span class="text-2xl font-semibold text-muted-foreground">Built for</span>
                    <span class="text-3xl font-bold">
                        <ui-morphing-text
                            [texts]="['Developers', 'Teams', 'Startups', 'Enterprises']"
                            [interval]="2000"
                        />
                    </span>
                </div>
                <div class="flex items-baseline gap-2">
                    <span class="text-2xl font-semibold text-muted-foreground">Focus on</span>
                    <span class="text-3xl font-bold text-violet-500">
                        <ui-morphing-text
                            [texts]="['UX', 'DX', 'Speed', 'Quality']"
                            [interval]="1800"
                        />
                    </span>
                </div>
            </div>
        `,
    }),
};
