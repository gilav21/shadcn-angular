import { Meta, StoryObj } from '@storybook/angular';
import { ChartBrushComponent, BrushSelection } from './chart-brush.component';

// A controlled zoom/pan/brush overlay that works in pixel space along the
// x-axis. Every input is exposed as an interactive control (argTypes) with a
// sensible default (args); the Playground binds all of them so the Controls
// panel drives the live component. selectionChange is emitted as the user
// drags/moves/resizes the brush.
const meta: Meta<ChartBrushComponent> = {
    title: 'UI/Chart/ChartBrush',
    component: ChartBrushComponent,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Controlled zoom/pan/brush overlay for dense cartesian charts. Drag on the track to create a selection, drag the middle to move it, or drag either edge to resize. Emits `selectionChange` in pixel space; the host chart maps pixels to the data domain.',
            },
        },
    },
    argTypes: {
        width: {
            control: { type: 'number', min: 100, max: 800, step: 10 },
            description: 'Brush track width in pixels (the pixel coordinate space of the selection).',
        },
        height: {
            control: { type: 'number', min: 16, max: 120, step: 4 },
            description: 'Brush track height in pixels.',
        },
        selection: {
            control: 'object',
            description: 'Controlled selection `{ start, end }` in pixels, or `null` for no selection.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the SVG host.' },
    },
    args: {
        width: 400,
        height: 40,
        selection: null,
        class: '',
    },
};

export default meta;
type Story = StoryObj<ChartBrushComponent>;

const render: NonNullable<Story['render']> = (args) => ({
    props: {
        ...args,
        onSelectionChange: (sel: BrushSelection | null): void => {
            // eslint-disable-next-line no-console
            console.log('selectionChange', sel);
        },
    },
    template: `
        <div class="w-full max-w-[440px] rounded-md border bg-card p-4">
            <p class="mb-2 text-sm text-muted-foreground">Drag on the track to brush a range.</p>
            <ui-chart-brush
                [width]="width"
                [height]="height"
                [selection]="selection"
                [class]="class"
                (selectionChange)="onSelectionChange($event)"
            />
        </div>
    `,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Empty: Story = {
    args: { selection: null },
    render,
};

export const WithSelection: Story = {
    args: { selection: { start: 120, end: 280 } },
    render,
};

export const Tall: Story = {
    args: { height: 96, selection: { start: 80, end: 240 } },
    render,
};
