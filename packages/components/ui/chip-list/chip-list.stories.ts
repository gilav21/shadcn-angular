import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { FormsModule } from '@angular/forms';
import { ChipListComponent } from './chip-list.component';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct mode.
const meta: Meta<ChipListComponent> = {
    title: 'UI/Chip List',
    component: ChipListComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [FormsModule, ChipListComponent],
        }),
    ],
    argTypes: {
        placeholder: { control: 'text', description: 'Placeholder text shown when no chips exist.' },
        disabled: { control: 'boolean', description: 'Disables the entire chip list.' },
        variant: {
            control: 'select',
            options: ['outline', 'underline', 'ghost'],
            description: 'Container style variant for the chip list itself.',
        },
        badgeVariant: {
            control: 'select',
            options: ['default', 'secondary', 'destructive', 'outline'],
            description: 'Visual style variant applied to each chip (badge), unless overridden by `chipColors`.',
        },
        maxRows: { control: 'number', description: 'Maximum visible rows before scrolling (0 = unlimited).' },
        allowDuplicates: { control: 'boolean', description: 'Allow duplicate chip values to be added.' },
        chipColors: { control: 'object', description: 'Map of chip value to a custom background color, overriding `badgeVariant` for matching chips.' },
        separatorKeys: { control: 'object', description: 'Extra keyboard keys (besides Enter) that commit the current input as a chip.' },
        class: { control: 'text', description: 'Extra classes merged onto the host container.' },
    },
    args: {
        placeholder: 'Add item...',
        disabled: false,
        variant: 'outline',
        badgeVariant: 'default',
        maxRows: 0,
        allowDuplicates: false,
        chipColors: {},
        separatorKeys: [],
        class: '',
    },
};

export default meta;
type Story = StoryObj<ChipListComponent>;

const TEMPLATE = `
    <div class="w-full max-w-[calc(100vw-2rem)] sm:w-[400px]">
        <ui-chip-list
            [(ngModel)]="tags"
            [placeholder]="placeholder"
            [disabled]="disabled"
            [variant]="variant"
            [badgeVariant]="badgeVariant"
            [maxRows]="maxRows"
            [allowDuplicates]="allowDuplicates"
            [chipColors]="chipColors"
            [separatorKeys]="separatorKeys"
            [class]="class">
        </ui-chip-list>
        <p class="mt-2 text-sm text-muted-foreground">Current values: {{ tags | json }}</p>
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: { ...args, tags: ['Angular', 'TypeScript'] },
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Variants: Story = {
    render: () => ({
        props: {
            outlineTags: ['Outline', 'Style'],
            underlineTags: ['Underline', 'Style'],
            ghostTags: ['Ghost', 'Style'],
        },
        template: `
            <div class="flex flex-col gap-4 w-full max-w-[calc(100vw-2rem)] sm:w-[400px]">
                <div>
                    <label class="text-sm font-medium mb-1 block">Outline</label>
                    <ui-chip-list [(ngModel)]="outlineTags" variant="outline" />
                </div>
                <div>
                    <label class="text-sm font-medium mb-1 block">Underline</label>
                    <ui-chip-list [(ngModel)]="underlineTags" variant="underline" />
                </div>
                <div>
                    <label class="text-sm font-medium mb-1 block">Ghost</label>
                    <ui-chip-list [(ngModel)]="ghostTags" variant="ghost" />
                </div>
            </div>`,
    }),
};

export const BadgeVariants: Story = {
    render: () => ({
        props: {
            defaultTags: ['Default', 'Style'],
            secondaryTags: ['Secondary', 'Style'],
            destructiveTags: ['Destructive', 'Style'],
            outlineTags: ['Outline', 'Style'],
        },
        template: `
            <div class="flex flex-col gap-4 w-full max-w-[calc(100vw-2rem)] sm:w-[400px]">
                <div>
                    <label class="text-sm font-medium mb-1 block">Default</label>
                    <ui-chip-list [(ngModel)]="defaultTags" badgeVariant="default" />
                </div>
                <div>
                    <label class="text-sm font-medium mb-1 block">Secondary</label>
                    <ui-chip-list [(ngModel)]="secondaryTags" badgeVariant="secondary" />
                </div>
                <div>
                    <label class="text-sm font-medium mb-1 block">Destructive</label>
                    <ui-chip-list [(ngModel)]="destructiveTags" badgeVariant="destructive" />
                </div>
                <div>
                    <label class="text-sm font-medium mb-1 block">Outline</label>
                    <ui-chip-list [(ngModel)]="outlineTags" badgeVariant="outline" />
                </div>
            </div>`,
    }),
};

export const CustomChipColors: Story = {
    render: () => ({
        props: {
            tags: ['Urgent', 'Backend', 'Design'],
            chipColors: { Urgent: '#ef4444', Backend: '#3b82f6', Design: '#8b5cf6' },
        },
        template: `
            <div class="w-full max-w-[calc(100vw-2rem)] sm:w-[400px]">
                <ui-chip-list [(ngModel)]="tags" [chipColors]="chipColors" />
            </div>`,
    }),
};

export const MaxRows: Story = {
    args: {
        maxRows: 2,
        placeholder: 'Add item (scrolls after 2 rows)...',
    },
    render: (args) => ({
        props: {
            ...args,
            tags: ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry', 'Fig', 'Grape', 'Honeydew', 'Kiwi', 'Lemon'],
        },
        template: TEMPLATE,
    }),
};

export const Disabled: Story = {
    args: { disabled: true },
    render: (args) => ({
        props: { ...args, tags: ['Cannot', 'Edit', 'These'] },
        template: TEMPLATE,
    }),
};

export const CommaSeparated: Story = {
    args: {
        placeholder: 'Type tags (comma or enter to add)...',
        separatorKeys: [','],
    },
    render: (args) => ({
        props: { ...args, tags: [] },
        template: TEMPLATE,
    }),
};
