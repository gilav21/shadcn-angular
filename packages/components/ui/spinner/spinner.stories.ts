import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { SpinnerComponent } from './spinner.component';
import { PageSpinnerComponent } from './sub/page-spinner.component';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const meta: Meta<SpinnerComponent> = {
    title: 'UI/Spinner',
    component: SpinnerComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [SpinnerComponent, PageSpinnerComponent],
        }),
    ],
    argTypes: {
        size: {
            control: 'select',
            options: ['xs', 'sm', 'default', 'lg', 'xl', 'page'],
            description: 'Size preset for the spinner glyph.',
        },
        variant: {
            control: 'select',
            options: ['ring', 'dots', 'bars', 'pulse'],
            description: 'Visual style of the loading indicator.',
        },
        customSize: {
            control: 'number',
            description: 'Overrides `size` with an exact pixel size (applies to the `ring` variant\'s inline style).',
        },
        class: { control: 'text', description: 'Extra classes merged onto the rendered indicator.' },
    },
    args: {
        size: 'default',
        variant: 'ring',
        customSize: null,
        class: '',
    },
};

export default meta;
type Story = StoryObj<SpinnerComponent>;

const TEMPLATE = `<ui-spinner [size]="size" [variant]="variant" [customSize]="customSize" [class]="class" />`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Sizes: Story = {
    render: () => ({
        template: `
        <div class="flex items-end gap-4">
            <ui-spinner size="xs" />
            <ui-spinner size="sm" />
            <ui-spinner size="default" />
            <ui-spinner size="lg" />
            <ui-spinner size="xl" />
        </div>
        `
    })
};

export const Variants: Story = {
    render: () => ({
        template: `
        <div class="flex flex-col gap-8">
            <div class="flex items-center gap-6">
                <p class="w-16 text-sm text-muted-foreground">Ring</p>
                <ui-spinner variant="ring" size="default" />
            </div>
            <div class="flex items-center gap-6">
                <p class="w-16 text-sm text-muted-foreground">Dots</p>
                <ui-spinner variant="dots" size="default" />
            </div>
            <div class="flex items-center gap-6">
                <p class="w-16 text-sm text-muted-foreground">Bars</p>
                <ui-spinner variant="bars" size="default" />
            </div>
            <div class="flex items-center gap-6">
                <p class="w-16 text-sm text-muted-foreground">Pulse</p>
                <ui-spinner variant="pulse" size="default" />
            </div>
        </div>
        `
    })
};

export const DotsVariantSizes: Story = {
    name: 'Dots — All Sizes',
    render: () => ({
        template: `
        <div class="flex items-end gap-4">
            <ui-spinner variant="dots" size="xs" />
            <ui-spinner variant="dots" size="sm" />
            <ui-spinner variant="dots" size="default" />
            <ui-spinner variant="dots" size="lg" />
            <ui-spinner variant="dots" size="xl" />
        </div>
        `
    })
};

export const BarsVariantSizes: Story = {
    name: 'Bars — All Sizes',
    render: () => ({
        template: `
        <div class="flex items-end gap-4">
            <ui-spinner variant="bars" size="xs" />
            <ui-spinner variant="bars" size="sm" />
            <ui-spinner variant="bars" size="default" />
            <ui-spinner variant="bars" size="lg" />
            <ui-spinner variant="bars" size="xl" />
        </div>
        `
    })
};

export const PulseVariantSizes: Story = {
    name: 'Pulse — All Sizes',
    render: () => ({
        template: `
        <div class="flex items-end gap-4">
            <ui-spinner variant="pulse" size="xs" />
            <ui-spinner variant="pulse" size="sm" />
            <ui-spinner variant="pulse" size="default" />
            <ui-spinner variant="pulse" size="lg" />
            <ui-spinner variant="pulse" size="xl" />
        </div>
        `
    })
};

export const CustomSize: Story = {
    name: 'Custom Size (px override)',
    render: () => ({
        template: `
        <div class="flex items-end gap-6">
            <ui-spinner [customSize]="24" />
            <ui-spinner [customSize]="48" />
            <ui-spinner [customSize]="72" />
        </div>
        `
    })
};

export const CustomLoader: Story = {
    name: 'Custom Loader (Content Projection)',
    render: () => ({
        template: `
        <div class="flex items-center gap-6">
            <ui-spinner>
                <span class="text-primary font-bold animate-spin inline-block text-2xl">⟳</span>
            </ui-spinner>
        </div>
        `
    })
};

export const FullPageOverlay: Story = {
    name: 'Full Page Overlay (Page Spinner)',
    render: () => ({
        template: `
        <div class="relative h-64 w-full overflow-hidden rounded-md border" style="transform: translateZ(0);">
            <div class="p-4 text-sm text-muted-foreground">
                Page content behind the overlay stays in the DOM — the spinner covers it.
            </div>
            <ui-page-spinner message="Loading your data..." />
        </div>
        `
    })
};
