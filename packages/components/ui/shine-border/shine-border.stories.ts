import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { ShineBorderComponent } from './shine-border.component';

const meta: Meta<ShineBorderComponent> = {
    title: 'UI/Shine Border',
    component: ShineBorderComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [ShineBorderComponent],
        }),
    ],
    argTypes: {
        class: { control: 'text', description: 'Extra classes merged onto the wrapper.' },
        colors: { control: 'object', description: 'Conic-gradient color stops for the animated border.' },
        duration: { control: 'number', description: 'Full rotation duration in seconds.', min: 0.5, max: 10, step: 0.5 },
        borderWidth: { control: 'number', description: 'Border thickness in pixels.', min: 1, max: 12 },
        borderRadius: { control: 'number', description: 'Corner radius in pixels.', min: 0, max: 32 },
    },
    args: {
        class: '',
        duration: 3,
        borderWidth: 2,
        borderRadius: 8,
        colors: ['#A07CFE', '#FE8FB5', '#FFBE7B'],
    },
};

export default meta;
type Story = StoryObj<ShineBorderComponent>;

const TEMPLATE = `
    <div class="flex items-center justify-center p-12">
        <ui-shine-border [class]="class" [colors]="colors" [duration]="duration" [borderWidth]="borderWidth" [borderRadius]="borderRadius">
            <div class="px-8 py-6 bg-background rounded-[6px]">
                <h3 class="text-xl font-semibold">Shine Border Card</h3>
                <p class="text-muted-foreground mt-1 text-sm">
                    A card with an animated conic gradient border.
                </p>
            </div>
        </ui-shine-border>
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const CustomColors: Story = {
    render: () => ({
        template: `
            <div class="flex flex-wrap items-center justify-center gap-6 p-12">
                <ui-shine-border [colors]="['#ec4899', '#a855f7', '#3b82f6']" [borderRadius]="12">
                    <div class="px-6 py-4 bg-background rounded-[10px]">
                        <h3 class="text-base font-semibold">Pink · Purple · Blue</h3>
                        <p class="text-muted-foreground text-xs mt-1">Cool spectrum</p>
                    </div>
                </ui-shine-border>
                <ui-shine-border [colors]="['#f97316', '#eab308', '#22c55e']" [borderRadius]="12">
                    <div class="px-6 py-4 bg-background rounded-[10px]">
                        <h3 class="text-base font-semibold">Orange · Yellow · Green</h3>
                        <p class="text-muted-foreground text-xs mt-1">Warm tones</p>
                    </div>
                </ui-shine-border>
                <ui-shine-border [colors]="['#06b6d4', '#6366f1']" [borderRadius]="12">
                    <div class="px-6 py-4 bg-background rounded-[10px]">
                        <h3 class="text-base font-semibold">Cyan · Indigo</h3>
                        <p class="text-muted-foreground text-xs mt-1">Two-tone</p>
                    </div>
                </ui-shine-border>
            </div>
        `,
    }),
};

export const ThickBorder: Story = {
    args: {
        borderWidth: 4,
        borderRadius: 16,
        duration: 2,
    },
    render,
};

export const ButtonVariant: Story = {
    render: () => ({
        template: `
            <div class="flex items-center justify-center gap-4 p-12">
                <ui-shine-border [borderRadius]="6" [borderWidth]="1" [duration]="2">
                    <button class="px-6 py-2.5 bg-background rounded-[5px] text-sm font-medium hover:bg-muted transition-colors">
                        Shine Button
                    </button>
                </ui-shine-border>
                <ui-shine-border [colors]="['#06b6d4', '#a855f7']" [borderRadius]="6" [borderWidth]="1" [duration]="1.5">
                    <button class="px-6 py-2.5 bg-background rounded-[5px] text-sm font-medium hover:bg-muted transition-colors">
                        Fast Shine
                    </button>
                </ui-shine-border>
            </div>
        `,
    }),
};
