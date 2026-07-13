import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
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
        position: { control: 'select', options: ['top', 'bottom'], description: 'Which edge of the nearest scroll container the bar is pinned to.' },
        color: { control: 'color', description: 'Bar fill color (any CSS color).' },
        height: { control: 'number', description: 'Bar thickness in pixels.', min: 1, max: 12 },
        container: { control: false, description: 'Explicit scroll target (CSS selector string or HTMLElement). Falls back to the nearest scrollable ancestor.' },
        class: { control: 'text', description: 'Extra classes merged onto the bar element.' },
    },
    args: {
        position: 'top',
        color: 'var(--primary)',
        height: 3,
        container: null,
        class: '',
    },
};

export default meta;
type Story = StoryObj<ScrollProgressComponent>;

const TEMPLATE = `
    <div class="relative h-[400px] overflow-y-auto border rounded-lg" tabindex="0">
        <ui-scroll-progress [position]="position" [color]="color" [height]="height" [class]="class" />
        <div class="p-4 sm:p-6 space-y-4" style="height: 1200px;">
            <h2 class="text-xl font-bold sticky top-0 bg-background py-2 border-b">
                Scroll Progress Demo
            </h2>
            <p class="text-muted-foreground text-sm">Scroll this container to see the progress bar.</p>
            <div class="grid gap-3">
                <div class="h-24 rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">Section 1</div>
                <div class="h-24 rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">Section 2</div>
                <div class="h-24 rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">Section 3</div>
                <div class="h-24 rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">Section 4</div>
                <div class="h-24 rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">Section 5</div>
                <div class="h-24 rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">Section 6</div>
            </div>
        </div>
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const TopPosition: Story = {
    args: { position: 'top', height: 3 },
    render,
};

export const BottomPosition: Story = {
    args: { position: 'bottom', height: 4 },
    render,
};

export const CustomColor: Story = {
    args: { position: 'top', color: '#ec4899', height: 5 },
    render,
};
