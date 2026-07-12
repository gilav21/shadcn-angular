import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { PopoverComponent } from './popover.component';
import { PopoverTriggerComponent } from './sub/popover-trigger.component';
import { PopoverContentComponent } from './sub/popover-content.component';
import { PopoverCloseComponent } from './sub/popover-close.component';
import { ButtonComponent } from '../button';
import { InputComponent } from '../input';
import { LabelComponent } from '../label';

// The positioning inputs (align, side, sideOffset, avoidCollisions, restoreFocus,
// strategy, class) live on `ui-popover-content`, while the open state
// (`open` model) and `closeOnScroll` live on the `ui-popover` root — the story
// args type intersects both so every input surfaces in the Controls panel.
// `meta.component` points at the content component for the auto props table.
// The Playground binds all of them so the Controls panel drives the live
// component. Dedicated stories below capture each distinct visual mode.
type PopoverStoryArgs = PopoverContentComponent & Pick<PopoverComponent, 'open' | 'closeOnScroll'>;

const meta: Meta<PopoverStoryArgs> = {
    title: 'UI/Popover',
    component: PopoverContentComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                PopoverComponent,
                PopoverTriggerComponent,
                PopoverContentComponent,
                PopoverCloseComponent,
                ButtonComponent,
                InputComponent,
                LabelComponent,
            ],
        }),
    ],
    argTypes: {
        align: { control: 'select', options: ['start', 'center', 'end'], description: 'Alignment along the side axis.' },
        side: { control: 'select', options: ['top', 'right', 'bottom', 'left'], description: 'Side of the trigger the content opens on.' },
        sideOffset: { control: 'number', description: 'Gap between the trigger and the content, in px.' },
        avoidCollisions: { control: 'boolean', description: 'Flips/shifts the content to stay within the viewport/clipping ancestor.' },
        restoreFocus: { control: 'boolean', description: 'Restores focus to the trigger when the popover closes.' },
        strategy: {
            control: 'select',
            options: ['absolute', 'fixed'],
            description: "Positioning strategy. `'fixed'` promotes the content to the native Popover API top layer (via `showPopover()`), so it renders above ANY modal/dialog/overflow ancestor — falls back to a `document.body` portal on engines without the API.",
        },
        class: { control: 'text', description: 'Extra classes merged onto the content element.' },
        open: { control: 'boolean', description: 'Open state of the popover (two-way bindable via the `ui-popover` model).' },
        closeOnScroll: { control: 'boolean', description: 'Closes the popover when the page or a scroll ancestor scrolls.' },
    },
    args: {
        align: 'center',
        side: 'bottom',
        sideOffset: 4,
        avoidCollisions: true,
        restoreFocus: true,
        strategy: 'absolute',
        class: 'w-80',
        open: false,
        closeOnScroll: false,
    },
};

export default meta;
type Story = StoryObj<PopoverStoryArgs>;

const TEMPLATE = `
    <ui-popover [open]="open" [closeOnScroll]="closeOnScroll">
        <ui-popover-trigger>
            <ui-button variant="outline">Open Popover</ui-button>
        </ui-popover-trigger>
        <ui-popover-content
            [class]="class" [align]="align" [side]="side" [sideOffset]="sideOffset"
            [avoidCollisions]="avoidCollisions" [restoreFocus]="restoreFocus" [strategy]="strategy">
            <div class="grid gap-4">
                <div class="space-y-2">
                    <h4 class="font-medium leading-none">Dimensions</h4>
                    <p class="text-sm text-muted-foreground">Set the dimensions for the layer.</p>
                </div>
                <div class="grid gap-2">
                    <div class="grid grid-cols-3 items-center gap-4">
                        <ui-label for="width">Width</ui-label>
                        <ui-input id="width" value="100%" class="col-span-2 h-8" />
                    </div>
                    <div class="grid grid-cols-3 items-center gap-4">
                        <ui-label for="maxWidth">Max. width</ui-label>
                        <ui-input id="maxWidth" value="300px" class="col-span-2 h-8" />
                    </div>
                </div>
                <ui-popover-close>
                    <ui-button size="sm" variant="secondary">Close</ui-button>
                </ui-popover-close>
            </div>
        </ui-popover-content>
    </ui-popover>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every content input is wired to the Controls panel. */
export const Playground: Story = { render };

export const SideTop: Story = {
    args: { side: 'top' },
    render,
};

export const SideRight: Story = {
    args: { side: 'right' },
    render,
};

export const SideLeft: Story = {
    args: { side: 'left' },
    render,
};

export const AlignStart: Story = {
    args: { align: 'start' },
    render,
};

export const AlignEnd: Story = {
    args: { align: 'end' },
    render,
};

export const AvoidCollisionsOff: Story = {
    args: { avoidCollisions: false },
    render,
};

/**
 * `strategy="fixed"` promotes the popover content to the browser's top layer
 * (via `showPopover()`), so it escapes `overflow: hidden` ancestors and
 * renders above any modal — including a native `<dialog>` or `ui-dialog`.
 */
export const StrategyFixed: Story = {
    args: { strategy: 'fixed' },
    render: (args) => ({
        props: args,
        template: `
            <div class="h-40 w-full max-w-sm overflow-hidden rounded-md border p-4">
                <p class="mb-4 text-sm text-muted-foreground">
                    This container clips overflow — an 'absolute' strategy popover would be cut off here.
                </p>
                ${TEMPLATE}
            </div>`,
    }),
};

export const RestoreFocusOff: Story = {
    args: { restoreFocus: false },
    render,
};
