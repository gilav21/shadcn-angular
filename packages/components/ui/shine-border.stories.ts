import { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
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
        duration: {
            control: 'number',
        },
        borderWidth: {
            control: 'number',
        },
        borderRadius: {
            control: 'number',
        },
    },
    args: {
        duration: 3,
        borderWidth: 2,
        borderRadius: 8,
    },
};

export default meta;
type Story = StoryObj<ShineBorderComponent>;

export const Default: Story = {
    render: () => ({
        template: `
            <div class="flex items-center justify-center p-12">
                <ui-shine-border>
                    <div class="px-8 py-6 bg-background rounded-[6px]">
                        <h3 class="text-xl font-semibold">Shine Border Card</h3>
                        <p class="text-muted-foreground mt-1 text-sm">
                            A card with an animated conic gradient border.
                        </p>
                    </div>
                </ui-shine-border>
            </div>
        `,
    }),
};

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
    render: (args) => ({
        props: args,
        template: `
            <div class="flex items-center justify-center p-12">
                <ui-shine-border
                    [borderWidth]="borderWidth"
                    [borderRadius]="borderRadius"
                    [duration]="duration"
                    [colors]="['#A07CFE', '#FE8FB5', '#FFBE7B']"
                >
                    <div class="px-10 py-8 bg-background rounded-[12px] text-center">
                        <div class="text-3xl mb-2">✨</div>
                        <h3 class="text-xl font-bold">Thick Shine</h3>
                        <p class="text-muted-foreground text-sm mt-1">
                            Border width: {{ borderWidth }}px — Duration: {{ duration }}s
                        </p>
                    </div>
                </ui-shine-border>
            </div>
        `,
    }),
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
