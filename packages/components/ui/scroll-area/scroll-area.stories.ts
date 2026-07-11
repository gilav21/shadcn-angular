import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { ScrollAreaComponent } from './scroll-area.component';
import { SeparatorComponent } from '../separator';

const meta: Meta<ScrollAreaComponent> = {
    title: 'UI/ScrollArea',
    component: ScrollAreaComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [ScrollAreaComponent, SeparatorComponent],
        }),
    ],
    argTypes: {
        orientation: {
            control: 'radio',
            options: ['vertical', 'horizontal', 'both'],
            description: 'Which scrollbar(s) to render custom thumbs for.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the scroll-area root (e.g. size/border).' },
    },
    args: {
        orientation: 'vertical',
        class: 'h-[200px] w-full sm:w-[350px] rounded-md border p-4',
    },
};

export default meta;
type Story = StoryObj<ScrollAreaComponent>;

const TEMPLATE = `
    <ui-scroll-area [orientation]="orientation" [class]="class">
        <div class="mb-4 text-sm font-medium leading-none">Tags</div>
        <div class="flex flex-col gap-2">
            @for (tag of tags; track tag) {
                <div class="text-sm">{{ tag }}</div>
                <ui-separator class="my-2" />
            }
        </div>
    </ui-scroll-area>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: {
        ...args,
        tags: Array.from({ length: 50 }).map((_, i, a) => `v1.2.0-beta.${a.length - i}`),
    },
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Vertical: Story = {
    args: { orientation: 'vertical', class: 'h-[200px] w-full sm:w-[350px] rounded-md border p-4' },
    render,
};

export const Horizontal: Story = {
    args: { orientation: 'horizontal', class: 'h-32 w-full sm:w-[350px] rounded-md border p-4' },
    render: (args) => ({
        props: args,
        template: `
            <ui-scroll-area [orientation]="orientation" [class]="class">
                <div class="flex gap-3 w-max">
                    @for (n of [1,2,3,4,5,6,7,8,9,10]; track n) {
                        <div class="h-20 w-24 shrink-0 rounded-md bg-muted flex items-center justify-center text-sm">Item {{ n }}</div>
                    }
                </div>
            </ui-scroll-area>`,
    }),
};

export const Both: Story = {
    args: { orientation: 'both', class: 'h-[220px] w-full sm:w-[350px] rounded-md border p-4' },
    render: (args) => ({
        props: args,
        template: `
            <ui-scroll-area [orientation]="orientation" [class]="class">
                <div class="grid grid-flow-col grid-rows-6 gap-2 w-max">
                    @for (n of [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]; track n) {
                        <div class="h-16 w-24 rounded-md bg-muted flex items-center justify-center text-sm">{{ n }}</div>
                    }
                </div>
            </ui-scroll-area>`,
    }),
};
