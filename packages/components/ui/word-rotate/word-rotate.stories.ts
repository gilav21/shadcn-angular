import { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { WordRotateComponent } from './word-rotate.component';

const meta: Meta<WordRotateComponent> = {
    title: 'UI/Word Rotate',
    component: WordRotateComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [WordRotateComponent],
        }),
    ],
    argTypes: {
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
        words: { control: 'object', description: 'List of words to cycle through.' },
        duration: { control: 'number', description: 'Time in ms each word is shown before rotating.', min: 200, step: 100 },
    },
    args: {
        class: 'text-primary',
        words: ['Developer', 'Designer', 'Creator'],
        duration: 2000,
    },
};

export default meta;
type Story = StoryObj<WordRotateComponent>;

const TEMPLATE = `
    <div class="flex items-center justify-center p-16">
        <h2 class="text-5xl font-bold">
            I am a&nbsp;
            <ui-word-rotate [words]="words" [duration]="duration" [class]="class" />
        </h2>
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = { render };

export const FastRotation: Story = {
    args: {
        words: ['Fast', 'Responsive', 'Beautiful', 'Modern'],
        duration: 1000,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="flex items-center justify-center p-16">
                <h2 class="text-4xl font-bold">
                    Build <ui-word-rotate [words]="words" [duration]="duration" class="text-violet-500" /> apps
                </h2>
            </div>
        `,
    }),
};

export const HeroSection: Story = {
    render: () => ({
        template: `
            <div class="flex flex-col items-center justify-center p-16 gap-4 text-center">
                <p class="text-sm text-muted-foreground uppercase tracking-widest font-medium">
                    shadcn-angular
                </p>
                <h1 class="text-6xl font-black leading-tight">
                    Design.&nbsp;
                    <ui-word-rotate
                        [words]="['Build.', 'Ship.', 'Scale.', 'Iterate.']"
                        [duration]="2000"
                        class="text-primary inline-block min-w-[160px]"
                    />
                </h1>
                <p class="text-muted-foreground max-w-md">
                    A component library built for Angular developers who want beautiful, accessible UI out of the box.
                </p>
            </div>
        `,
    }),
};

export const InlineVariants: Story = {
    render: () => ({
        template: `
            <div class="space-y-6 p-10">
                <div class="flex items-center gap-2 text-2xl font-semibold">
                    <span>Frameworks:</span>
                    <ui-word-rotate
                        [words]="['Angular', 'React', 'Vue', 'Svelte']"
                        [duration]="1800"
                        class="text-blue-500 min-w-[100px]"
                    />
                </div>
                <div class="flex items-center gap-2 text-2xl font-semibold">
                    <span>Status:</span>
                    <ui-word-rotate
                        [words]="['Active', 'Maintained', 'Open Source', 'Production Ready']"
                        [duration]="2200"
                        class="text-green-500 min-w-[180px]"
                    />
                </div>
                <div class="flex items-center gap-2 text-2xl font-semibold">
                    <span>Made with:</span>
                    <ui-word-rotate
                        [words]="['❤️ Love', '⚡ Speed', '🎨 Care', '🛠️ Craft']"
                        [duration]="1500"
                        class="min-w-[140px]"
                    />
                </div>
            </div>
        `,
    }),
};
