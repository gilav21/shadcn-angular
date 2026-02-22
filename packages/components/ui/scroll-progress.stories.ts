import { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { ScrollProgressComponent } from './scroll-progress.component';

const meta: Meta<ScrollProgressComponent> = {
    title: 'UI/Scroll Progress',
    component: ScrollProgressComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [ScrollProgressComponent],
        }),
    ],
    argTypes: {
        position: {
            control: 'select',
            options: ['top', 'bottom'],
        },
        color: {
            control: 'text',
        },
        height: {
            control: 'number',
        },
    },
    args: {
        position: 'top',
        color: 'hsl(var(--primary))',
        height: 3,
    },
};

export default meta;
type Story = StoryObj<ScrollProgressComponent>;

export const Default: Story = {
    args: {
        position: 'top',
        height: 3,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="relative h-[400px] overflow-y-auto border rounded-lg">
                <ui-scroll-progress [position]="position" [height]="height" />
                <div class="p-6 space-y-4" style="height: 1200px;">
                    <h2 class="text-xl font-bold sticky top-0 bg-background py-2 border-b">
                        Scroll Progress Demo (Top)
                    </h2>
                    <p class="text-muted-foreground text-sm">Scroll this container to see the progress bar at the top.</p>
                    <div class="grid gap-3">
                        <div class="h-24 rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">Section 1</div>
                        <div class="h-24 rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">Section 2</div>
                        <div class="h-24 rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">Section 3</div>
                        <div class="h-24 rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">Section 4</div>
                        <div class="h-24 rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">Section 5</div>
                        <div class="h-24 rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">Section 6</div>
                    </div>
                </div>
            </div>
        `,
    }),
};

export const BottomPosition: Story = {
    args: {
        position: 'bottom',
        height: 4,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="relative h-[400px] overflow-y-auto border rounded-lg">
                <ui-scroll-progress [position]="position" [height]="height" />
                <div class="p-6 space-y-4" style="height: 1200px;">
                    <h2 class="text-xl font-bold sticky top-0 bg-background py-2 border-b">
                        Scroll Progress Demo (Bottom)
                    </h2>
                    <p class="text-muted-foreground text-sm">The progress bar appears at the bottom of the viewport.</p>
                    <div class="grid gap-3">
                        <div class="h-24 rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">Section 1</div>
                        <div class="h-24 rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">Section 2</div>
                        <div class="h-24 rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">Section 3</div>
                        <div class="h-24 rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">Section 4</div>
                        <div class="h-24 rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">Section 5</div>
                    </div>
                </div>
            </div>
        `,
    }),
};

export const CustomColor: Story = {
    args: {
        position: 'top',
        color: '#ec4899',
        height: 5,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="relative h-[400px] overflow-y-auto border rounded-lg">
                <ui-scroll-progress [position]="position" [color]="color" [height]="height" />
                <div class="p-6 space-y-4" style="height: 1200px;">
                    <h2 class="text-xl font-bold sticky top-0 bg-background py-2 border-b">
                        Custom Color Progress Bar
                    </h2>
                    <p class="text-muted-foreground text-sm">Pink color, 5px height.</p>
                    <div class="grid gap-3">
                        <div class="h-24 rounded-lg bg-pink-50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-900 flex items-center justify-center text-sm text-pink-600">Section A</div>
                        <div class="h-24 rounded-lg bg-pink-50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-900 flex items-center justify-center text-sm text-pink-600">Section B</div>
                        <div class="h-24 rounded-lg bg-pink-50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-900 flex items-center justify-center text-sm text-pink-600">Section C</div>
                        <div class="h-24 rounded-lg bg-pink-50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-900 flex items-center justify-center text-sm text-pink-600">Section D</div>
                        <div class="h-24 rounded-lg bg-pink-50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-900 flex items-center justify-center text-sm text-pink-600">Section E</div>
                    </div>
                </div>
            </div>
        `,
    }),
};
