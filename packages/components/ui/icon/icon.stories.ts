import { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { IconComponent, DEFAULT_ICONS } from './icon.component';
import { provideIcons } from './icon.token';

const iconNames = Object.keys(DEFAULT_ICONS);

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
            options: iconNames,
            description: 'Icon name — either a built-in name or one registered via `provideIcons()`.',
        },
        size: {
            control: 'select',
            options: ['xs', 'sm', 'md', 'lg', 'xl'],
            description: 'Preset icon size.',
        },
        weight: {
            control: 'select',
            options: ['light', 'regular', 'thick', 'solid'],
            description: 'Stroke weight, or `solid` to fill.',
        },
        strokeWidth: {
            control: { type: 'range', min: 0.5, max: 4, step: 0.1 },
            description: 'Explicit stroke width; overrides the weight preset when set.',
        },
        color: {
            control: 'color',
            description: 'Stroke (or solid fill) color.',
        },
        fillColor: {
            control: 'color',
            description: 'Fill color, used alongside `color` for dual-tone icons.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the host (e.g. `size-6 text-red-500`).' },
    },
    args: {
        name: 'check',
        size: 'md',
        weight: 'regular',
        strokeWidth: undefined,
        color: undefined,
        fillColor: undefined,
        class: '',
    },
};

export default meta;
type Story = StoryObj<IconComponent>;

const TEMPLATE = `<ui-icon [name]="name" [size]="size" [weight]="weight" [strokeWidth]="strokeWidth" [color]="color" [fillColor]="fillColor" [class]="class"></ui-icon>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = {
    args: {
        name: 'check',
        size: 'md',
        weight: 'regular',
    },
    render,
};

export const Sizes: Story = {
    render: () => ({
        template: `
            <div class="flex items-end gap-6">
                <div class="flex flex-col items-center gap-2">
                    <ui-icon name="star" size="xs"></ui-icon>
                    <span class="text-xs text-muted-foreground">xs (12px)</span>
                </div>
                <div class="flex flex-col items-center gap-2">
                    <ui-icon name="star" size="sm"></ui-icon>
                    <span class="text-xs text-muted-foreground">sm (16px)</span>
                </div>
                <div class="flex flex-col items-center gap-2">
                    <ui-icon name="star" size="md"></ui-icon>
                    <span class="text-xs text-muted-foreground">md (24px)</span>
                </div>
                <div class="flex flex-col items-center gap-2">
                    <ui-icon name="star" size="lg"></ui-icon>
                    <span class="text-xs text-muted-foreground">lg (32px)</span>
                </div>
                <div class="flex flex-col items-center gap-2">
                    <ui-icon name="star" size="xl"></ui-icon>
                    <span class="text-xs text-muted-foreground">xl (48px)</span>
                </div>
            </div>
        `,
    }),
};

export const AllIcons: Story = {
    render: () => ({
        template: `
            <div class="grid grid-cols-8 gap-4">
                @for (icon of icons; track icon) {
                    <div class="flex flex-col items-center gap-2 p-3 rounded-lg border">
                        <ui-icon [name]="icon"></ui-icon>
                        <span class="text-[10px] text-muted-foreground text-center leading-tight">{{ icon }}</span>
                    </div>
                }
            </div>
        `,
        props: {
            icons: iconNames,
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
                    <ui-icon name="settings"></ui-icon>
                    <span class="text-xs text-muted-foreground">Settings</span>
                </div>
            </div>
        `,
    }),
};

export const Weights: Story = {
    render: () => ({
        template: `
            <div class="space-y-6">
                @for (icon of icons; track icon) {
                    <div class="flex items-center gap-8">
                        <span class="text-sm text-muted-foreground w-24">{{ icon }}</span>
                        <div class="flex items-center gap-6">
                            <div class="flex flex-col items-center gap-2">
                                <ui-icon [name]="icon" weight="light" size="lg"></ui-icon>
                                <span class="text-[10px] text-muted-foreground">light</span>
                            </div>
                            <div class="flex flex-col items-center gap-2">
                                <ui-icon [name]="icon" weight="regular" size="lg"></ui-icon>
                                <span class="text-[10px] text-muted-foreground">regular</span>
                            </div>
                            <div class="flex flex-col items-center gap-2">
                                <ui-icon [name]="icon" weight="thick" size="lg"></ui-icon>
                                <span class="text-[10px] text-muted-foreground">thick</span>
                            </div>
                            <div class="flex flex-col items-center gap-2">
                                <ui-icon [name]="icon" weight="solid" size="lg"></ui-icon>
                                <span class="text-[10px] text-muted-foreground">solid</span>
                            </div>
                        </div>
                    </div>
                }
            </div>
        `,
        props: {
            icons: ['heart', 'star', 'check', 'home', 'settings', 'bookmark', 'bell', 'shield'],
        },
    }),
};

export const Colors: Story = {
    render: () => ({
        template: `
            <div class="space-y-8">
                <div>
                    <h3 class="text-sm font-medium mb-3">Stroke color via color input</h3>
                    <div class="flex items-center gap-4">
                        <ui-icon name="heart" color="red" size="lg"></ui-icon>
                        <ui-icon name="star" color="#f59e0b" size="lg"></ui-icon>
                        <ui-icon name="check" color="green" size="lg"></ui-icon>
                        <ui-icon name="bell" color="blue" size="lg"></ui-icon>
                        <ui-icon name="shield" color="purple" size="lg"></ui-icon>
                    </div>
                </div>
                <div>
                    <h3 class="text-sm font-medium mb-3">Solid + color</h3>
                    <div class="flex items-center gap-4">
                        <ui-icon name="heart" weight="solid" color="red" size="lg"></ui-icon>
                        <ui-icon name="star" weight="solid" color="#f59e0b" size="lg"></ui-icon>
                        <ui-icon name="check-circle" weight="solid" color="green" size="lg"></ui-icon>
                        <ui-icon name="bell" weight="solid" color="blue" size="lg"></ui-icon>
                        <ui-icon name="shield" weight="solid" color="purple" size="lg"></ui-icon>
                    </div>
                </div>
                <div>
                    <h3 class="text-sm font-medium mb-3">Stroke + fill (dual color)</h3>
                    <div class="flex items-center gap-4">
                        <ui-icon name="heart" color="red" fillColor="pink" size="lg"></ui-icon>
                        <ui-icon name="star" color="#b45309" fillColor="#fef3c7" size="lg"></ui-icon>
                        <ui-icon name="bookmark" color="blue" fillColor="#dbeafe" size="lg"></ui-icon>
                        <ui-icon name="shield" color="green" fillColor="#dcfce7" size="lg"></ui-icon>
                    </div>
                </div>
                <div>
                    <h3 class="text-sm font-medium mb-3">Using Tailwind classes</h3>
                    <div class="flex items-center gap-4">
                        <ui-icon name="heart" class="text-red-500" size="lg"></ui-icon>
                        <ui-icon name="star" class="text-yellow-500" size="lg"></ui-icon>
                        <ui-icon name="check" class="text-green-500" size="lg"></ui-icon>
                        <ui-icon name="bell" class="text-blue-500" size="lg"></ui-icon>
                    </div>
                </div>
            </div>
        `,
    }),
};

export const WithCustomIcons: Story = {
    decorators: [
        moduleMetadata({
            providers: [
                provideIcons({
                    'github': '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" />',
                    'npm': '<path d="M1 8v8h6v1H12V8z" /><path d="M7 8v8" /><path d="M12 8v8" /><path d="M12 11h6v5" /><path d="M15 11v5" /><path d="M19 8v8" />',
                }),
            ],
        }),
    ],
    render: () => ({
        template: `
            <div class="flex items-center gap-6">
                <div class="flex flex-col items-center gap-2">
                    <ui-icon name="github"></ui-icon>
                    <span class="text-xs text-muted-foreground">github (custom)</span>
                </div>
                <div class="flex flex-col items-center gap-2">
                    <ui-icon name="npm"></ui-icon>
                    <span class="text-xs text-muted-foreground">npm (custom)</span>
                </div>
                <div class="flex flex-col items-center gap-2">
                    <ui-icon name="check" class="text-green-500"></ui-icon>
                    <span class="text-xs text-muted-foreground">check (built-in)</span>
                </div>
            </div>
        `,
    }),
};
