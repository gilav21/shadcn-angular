import { Meta, StoryObj } from '@storybook/angular';
import { AspectRatioComponent } from './aspect-ratio.component';

// The only input (ratio) is exposed as an interactive control (argTypes) with
// a sensible default (args); the Playground binds it so the Controls panel
// drives the live component. Dedicated stories below capture common ratios.
const meta: Meta<AspectRatioComponent> = {
    title: 'UI/AspectRatio',
    component: AspectRatioComponent,
    tags: ['autodocs'],
    argTypes: {
        ratio: {
            control: 'number',
            min: 0.1,
            max: 4,
            step: 0.05,
            description: 'The aspect ratio of the content (width / height).',
        },
    },
    args: {
        ratio: 16 / 9,
    },
};

export default meta;
type Story = StoryObj<AspectRatioComponent>;

const TEMPLATE = `
    <div class="w-full sm:w-[450px]">
        <ui-aspect-ratio [ratio]="ratio">
            <img
                src="https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=800&dpr=2&q=80"
                alt="Photo by Drew Beamer"
                class="rounded-md object-cover h-full w-full"
            />
        </ui-aspect-ratio>
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — the ratio input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Widescreen: Story = {
    args: { ratio: 16 / 9 },
    render,
};

export const Square: Story = {
    args: { ratio: 1 },
    render: (args) => ({
        props: args,
        template: `
            <div class="w-full sm:w-[200px]">
                <ui-aspect-ratio [ratio]="ratio">
                    <img
                        src="https://images.unsplash.com/photo-1576075796033-848c2a5f3696?w=800&dpr=2&q=80"
                        alt="Photo by Alvaro Pinot"
                        class="rounded-md object-cover h-full w-full"
                    />
                </ui-aspect-ratio>
            </div>`,
    }),
};

export const Standard: Story = {
    args: { ratio: 4 / 3 },
    render,
};

export const Portrait: Story = {
    args: { ratio: 9 / 16 },
    render: (args) => ({
        props: args,
        template: `
            <div class="w-full sm:w-[250px]">
                <ui-aspect-ratio [ratio]="ratio">
                    <img
                        src="https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=800&dpr=2&q=80"
                        alt="Photo by Drew Beamer"
                        class="rounded-md object-cover h-full w-full"
                    />
                </ui-aspect-ratio>
            </div>`,
    }),
};
