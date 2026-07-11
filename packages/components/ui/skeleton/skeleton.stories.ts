import { Meta, StoryObj } from '@storybook/angular';
import { SkeletonComponent } from './skeleton.component';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const meta: Meta<SkeletonComponent> = {
    title: 'UI/Skeleton',
    component: SkeletonComponent,
    tags: ['autodocs'],
    argTypes: {
        variant: {
            control: 'select',
            options: ['pulse', 'shimmer'],
            description: 'Loading animation style.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the host, typically used to set size/shape.' },
    },
    args: {
        variant: 'pulse',
        class: 'h-12 w-48',
    },
};

export default meta;
type Story = StoryObj<SkeletonComponent>;

const TEMPLATE = `<ui-skeleton [variant]="variant" [class]="class"></ui-skeleton>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Variants: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="flex flex-wrap items-center gap-6">
                <div class="flex flex-col gap-2">
                    <span class="text-xs text-muted-foreground">pulse</span>
                    <ui-skeleton variant="pulse" class="h-12 w-48"></ui-skeleton>
                </div>
                <div class="flex flex-col gap-2">
                    <span class="text-xs text-muted-foreground">shimmer</span>
                    <ui-skeleton variant="shimmer" class="h-12 w-48"></ui-skeleton>
                </div>
            </div>`,
    }),
};

export const CardPlaceholder: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="flex items-center space-x-4">
                <ui-skeleton class="h-12 w-12 rounded-full" [variant]="variant"></ui-skeleton>
                <div class="space-y-2">
                    <ui-skeleton class="h-4 w-[250px]" [variant]="variant"></ui-skeleton>
                    <ui-skeleton class="h-4 w-[200px]" [variant]="variant"></ui-skeleton>
                </div>
            </div>`,
    }),
};

export const CirclesAndLines: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="flex flex-col gap-3 w-[300px]">
                <div class="flex items-center gap-3">
                    <ui-skeleton class="h-10 w-10 rounded-full" [variant]="variant"></ui-skeleton>
                    <ui-skeleton class="h-4 flex-1" [variant]="variant"></ui-skeleton>
                </div>
                <ui-skeleton class="h-4 w-full" [variant]="variant"></ui-skeleton>
                <ui-skeleton class="h-4 w-5/6" [variant]="variant"></ui-skeleton>
                <ui-skeleton class="h-4 w-2/3" [variant]="variant"></ui-skeleton>
            </div>`,
    }),
};
