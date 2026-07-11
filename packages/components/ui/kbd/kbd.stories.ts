import { Meta, StoryObj } from '@storybook/angular';
import { KbdComponent } from './kbd.component';

const meta: Meta<KbdComponent> = {
    title: 'UI/Kbd',
    component: KbdComponent,
    tags: ['autodocs'],
    argTypes: {
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        class: '',
    },
};

export default meta;
type Story = StoryObj<KbdComponent>;

const TEMPLATE = `<ui-kbd [class]="class">K</ui-kbd>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const SingleKey: Story = {
    render: () => ({
        template: `
            <div class="flex items-center gap-4">
                <ui-kbd>A</ui-kbd>
                <ui-kbd>Enter</ui-kbd>
                <ui-kbd>Tab</ui-kbd>
                <ui-kbd>Esc</ui-kbd>
                <ui-kbd>Space</ui-kbd>
            </div>
        `,
    }),
};

export const ComboKeys: Story = {
    render: () => ({
        template: `
            <div class="flex flex-col gap-4">
                <div class="flex items-center gap-1">
                    <span class="text-sm text-muted-foreground mr-2">Copy:</span>
                    <ui-kbd>Ctrl</ui-kbd>
                    <span class="text-xs text-muted-foreground">+</span>
                    <ui-kbd>C</ui-kbd>
                </div>
                <div class="flex items-center gap-1">
                    <span class="text-sm text-muted-foreground mr-2">Paste:</span>
                    <ui-kbd>Ctrl</ui-kbd>
                    <span class="text-xs text-muted-foreground">+</span>
                    <ui-kbd>V</ui-kbd>
                </div>
                <div class="flex items-center gap-1">
                    <span class="text-sm text-muted-foreground mr-2">Search:</span>
                    <ui-kbd>Ctrl</ui-kbd>
                    <span class="text-xs text-muted-foreground">+</span>
                    <ui-kbd>Shift</ui-kbd>
                    <span class="text-xs text-muted-foreground">+</span>
                    <ui-kbd>F</ui-kbd>
                </div>
            </div>
        `,
    }),
};

export const MacKeys: Story = {
    render: () => ({
        template: `
            <div class="flex flex-col gap-4">
                <div class="flex items-center gap-1">
                    <span class="text-sm text-muted-foreground mr-2">Command Palette:</span>
                    <ui-kbd>&#8984;</ui-kbd>
                    <span class="text-xs text-muted-foreground">+</span>
                    <ui-kbd>K</ui-kbd>
                </div>
                <div class="flex items-center gap-1">
                    <span class="text-sm text-muted-foreground mr-2">Save:</span>
                    <ui-kbd>&#8984;</ui-kbd>
                    <span class="text-xs text-muted-foreground">+</span>
                    <ui-kbd>S</ui-kbd>
                </div>
                <div class="flex items-center gap-1">
                    <span class="text-sm text-muted-foreground mr-2">Undo:</span>
                    <ui-kbd>&#8984;</ui-kbd>
                    <span class="text-xs text-muted-foreground">+</span>
                    <ui-kbd>Z</ui-kbd>
                </div>
            </div>
        `,
    }),
};

export const CustomClass: Story = {
    render: () => ({
        template: `
            <div class="flex items-center gap-4">
                <ui-kbd class="bg-primary text-primary-foreground border-primary">Custom</ui-kbd>
                <ui-kbd class="text-lg px-3 h-8">Large</ui-kbd>
                <ui-kbd class="rounded-full">Round</ui-kbd>
            </div>
        `,
    }),
};
