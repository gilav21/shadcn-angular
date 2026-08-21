import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { MasonryComponent } from './index';

const HEIGHTS = [120, 200, 80, 160, 240, 100, 180, 60, 140, 220, 90, 170];

const cards = (count = HEIGHTS.length): string =>
    HEIGHTS.slice(0, count)
        .map(
            (height, index) => `
                <div
                    class="rounded-lg border bg-card p-4 text-sm text-card-foreground"
                    style="height: ${height}px"
                >Card ${index + 1}</div>`
        )
        .join('');

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct mode.
const meta: Meta<MasonryComponent> = {
    title: 'UI/Masonry',
    component: MasonryComponent,
    tags: ['autodocs'],
    decorators: [moduleMetadata({ imports: [MasonryComponent] })],
    parameters: {
        docs: {
            description: {
                component:
                    'Column-balanced layout for items of uneven height. Unlike CSS `columns`, items stay in **source order** in the DOM and are positioned into the shortest column, so keyboard and screen-reader traversal follows the visual reading order.',
            },
        },
    },
    argTypes: {
        columns: {
            control: 'object',
            description:
                'A fixed column count, or a per-breakpoint map (`{ base, sm, md, lg, xl }`) resolved against the masonry container\'s own width.',
        },
        gap: { control: 'number', description: 'Gutter between columns and items, in pixels.' },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        columns: { base: 1, sm: 2, lg: 3 },
        gap: 16,
        class: '',
    },
};

export default meta;
type Story = StoryObj<MasonryComponent>;

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = {
    render: (args) => ({
        props: args,
        template: `<ui-masonry [columns]="columns" [gap]="gap" [class]="class">${cards()}</ui-masonry>`,
    }),
};

/** A fixed column count, ignoring the container width. */
export const FixedColumns: Story = {
    render: () => ({
        template: `<ui-masonry [columns]="4">${cards()}</ui-masonry>`,
    }),
};

/** Responsive counts: 1 column on a phone, 2 from `sm`, 3 from `lg`. */
export const Responsive: Story = {
    render: () => ({
        template: `<ui-masonry [columns]="{ base: 1, sm: 2, lg: 3 }">${cards()}</ui-masonry>`,
    }),
};

/** Narrow container — the breakpoints follow the container, not the viewport. */
export const NarrowContainer: Story = {
    render: () => ({
        template: `
            <div class="w-[320px] max-w-full rounded-lg border p-4">
                <ui-masonry [columns]="{ base: 1, sm: 2, lg: 3 }">${cards(6)}</ui-masonry>
            </div>`,
    }),
};

/** A wider gutter. */
export const WideGap: Story = {
    render: () => ({
        template: `<ui-masonry [columns]="3" [gap]="32">${cards(9)}</ui-masonry>`,
    }),
};

/** Right-to-left: the first column starts at the right edge. */
export const Rtl: Story = {
    render: () => ({
        template: `
            <div dir="rtl">
                <ui-masonry [columns]="3">${cards(9)}</ui-masonry>
            </div>`,
    }),
};
