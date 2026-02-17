import { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { IconComponent } from './icon.component';

const meta: Meta<IconComponent> = {
    title: 'UI/Icon',
    component: IconComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [IconComponent],
        }),
    ],
    argTypes: {
        name: {
            control: 'select',
            options: [
                'arrow-up', 'arrow-down', 'chevrons-up-down', 'chevron-left', 'chevron-right',
                'chevrons-left', 'chevrons-right', 'check', 'x', 'calendar', 'credit-card',
                'dollar-sign', 'activity', 'download', 'users', 'filter', 'list-filter',
                'box', 'trash-2', 'mouse-pointer-click', 'layers', 'columns-2', 'rows-2',
                'refresh-cw', 'loader', 'pencil', 'eye', 'upload', 'layout-template',
                'settings-2', 'grid-3x3', 'box-select', 'shuffle',
            ],
        },
    },
};

export default meta;
type Story = StoryObj<IconComponent>;

export const Default: Story = {
    args: {
        name: 'check',
    },
    render: (args) => ({
        props: args,
        template: `<ui-icon [name]="name"></ui-icon>`,
    }),
};

export const AllIcons: Story = {
    render: () => ({
        template: `
            <div class="grid grid-cols-6 gap-6">
                @for (icon of icons; track icon) {
                    <div class="flex flex-col items-center gap-2 p-3 rounded-lg border">
                        <ui-icon [name]="icon"></ui-icon>
                        <span class="text-xs text-muted-foreground">{{ icon }}</span>
                    </div>
                }
            </div>
        `,
        props: {
            icons: [
                'arrow-up', 'arrow-down', 'chevrons-up-down', 'chevron-left', 'chevron-right',
                'chevrons-left', 'chevrons-right', 'check', 'x', 'calendar', 'credit-card',
                'dollar-sign', 'activity', 'download', 'users', 'filter', 'list-filter',
                'box', 'trash-2', 'mouse-pointer-click', 'layers', 'columns-2', 'rows-2',
                'refresh-cw', 'loader', 'pencil', 'eye', 'upload', 'layout-template',
                'settings-2', 'grid-3x3', 'box-select', 'shuffle',
            ],
        },
    }),
};

export const CustomClass: Story = {
    render: () => ({
        template: `
            <div class="flex items-center gap-6">
                <ui-icon name="check" class="size-4 text-green-500"></ui-icon>
                <ui-icon name="x" class="size-6 text-red-500"></ui-icon>
                <ui-icon name="users" class="size-8 text-blue-500"></ui-icon>
                <ui-icon name="calendar" class="size-10 text-orange-500"></ui-icon>
            </div>
        `,
    }),
};

export const CommonActions: Story = {
    render: () => ({
        template: `
            <div class="flex items-center gap-4">
                <div class="flex flex-col items-center gap-1">
                    <ui-icon name="pencil"></ui-icon>
                    <span class="text-xs text-muted-foreground">Edit</span>
                </div>
                <div class="flex flex-col items-center gap-1">
                    <ui-icon name="trash-2"></ui-icon>
                    <span class="text-xs text-muted-foreground">Delete</span>
                </div>
                <div class="flex flex-col items-center gap-1">
                    <ui-icon name="download"></ui-icon>
                    <span class="text-xs text-muted-foreground">Download</span>
                </div>
                <div class="flex flex-col items-center gap-1">
                    <ui-icon name="upload"></ui-icon>
                    <span class="text-xs text-muted-foreground">Upload</span>
                </div>
                <div class="flex flex-col items-center gap-1">
                    <ui-icon name="eye"></ui-icon>
                    <span class="text-xs text-muted-foreground">View</span>
                </div>
                <div class="flex flex-col items-center gap-1">
                    <ui-icon name="settings-2"></ui-icon>
                    <span class="text-xs text-muted-foreground">Settings</span>
                </div>
            </div>
        `,
    }),
};
