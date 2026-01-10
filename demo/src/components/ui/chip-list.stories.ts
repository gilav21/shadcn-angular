import { Meta, StoryObj } from '@storybook/angular';
import { ChipListComponent } from './chip-list.component';
import { FormsModule } from '@angular/forms';
import { moduleMetadata } from '@storybook/angular';

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
        placeholder: {
            control: 'text',
            description: 'Placeholder text shown when no chips exist',
        },
        disabled: {
            control: 'boolean',
            description: 'Disable the entire chip list',
        },
        variant: {
            control: 'select',
            options: ['default', 'secondary', 'destructive', 'outline'],
            description: 'Visual style variant for chips',
        },
        maxRows: {
            control: 'number',
            description: 'Maximum visible rows before scrolling (0 = unlimited)',
        },
        allowDuplicates: {
            control: 'boolean',
            description: 'Allow duplicate chip values',
        },
    },
    args: {
        placeholder: 'Add tag...',
        disabled: false,
        variant: 'default',
        maxRows: 0,
        allowDuplicates: false,
    },
};

export default meta;
type Story = StoryObj<ChipListComponent>;

export const Default: Story = {
    render: (args) => ({
        props: {
            ...args,
            tags: ['Angular', 'TypeScript'],
        },
        template: `
      <div class="w-[400px]">
        <ui-chip-list 
          [(ngModel)]="tags" 
          [placeholder]="placeholder"
          [disabled]="disabled"
          [variant]="variant"
          [maxRows]="maxRows"
          [allowDuplicates]="allowDuplicates"
        />
        <p class="mt-4 text-sm text-muted-foreground">
          Current values: {{ tags | json }}
        </p>
      </div>
    `,
    }),
};

export const WithPrefilledValues: Story = {
    args: {
        placeholder: 'Add technology...',
    },
    render: (args) => ({
        props: {
            ...args,
            technologies: ['React', 'Vue', 'Angular', 'Svelte', 'SolidJS'],
        },
        template: `
      <div class="w-[400px]">
        <ui-chip-list 
          [(ngModel)]="technologies" 
          [placeholder]="placeholder"
          [variant]="variant"
        />
      </div>
    `,
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
            items: [
                'Apple', 'Banana', 'Cherry', 'Date', 'Elderberry',
                'Fig', 'Grape', 'Honeydew', 'Kiwi', 'Lemon'
            ],
        },
        template: `
      <div class="w-[400px]">
        <ui-chip-list 
          [(ngModel)]="items" 
          [placeholder]="placeholder"
          [maxRows]="maxRows"
          [variant]="variant"
        />
        <p class="mt-2 text-sm text-muted-foreground">
          This chip list scrolls after 2 rows of content
        </p>
      </div>
    `,
    }),
};

export const Variants: Story = {
    render: () => ({
        props: {
            defaultTags: ['Default', 'Style'],
            secondaryTags: ['Secondary', 'Style'],
            destructiveTags: ['Destructive', 'Style'],
            outlineTags: ['Outline', 'Style'],
        },
        template: `
      <div class="flex flex-col gap-4 w-[400px]">
        <div>
          <label class="text-sm font-medium mb-1 block">Default</label>
          <ui-chip-list [(ngModel)]="defaultTags" variant="default" />
        </div>
        <div>
          <label class="text-sm font-medium mb-1 block">Secondary</label>
          <ui-chip-list [(ngModel)]="secondaryTags" variant="secondary" />
        </div>
        <div>
          <label class="text-sm font-medium mb-1 block">Destructive</label>
          <ui-chip-list [(ngModel)]="destructiveTags" variant="destructive" />
        </div>
        <div>
          <label class="text-sm font-medium mb-1 block">Outline</label>
          <ui-chip-list [(ngModel)]="outlineTags" variant="outline" />
        </div>
      </div>
    `,
    }),
};

export const Disabled: Story = {
    args: {
        disabled: true,
    },
    render: (args) => ({
        props: {
            ...args,
            tags: ['Cannot', 'Edit', 'These'],
        },
        template: `
      <div class="w-[400px]">
        <ui-chip-list 
          [(ngModel)]="tags" 
          [disabled]="disabled"
          [variant]="variant"
        />
      </div>
    `,
    }),
};

export const EmailInput: Story = {
    args: {
        placeholder: 'Add email address...',
        variant: 'outline',
    },
    render: (args) => ({
        props: {
            ...args,
            emails: ['john@example.com'],
        },
        template: `
      <div class="w-[400px]">
        <label class="text-sm font-medium mb-1 block">Recipients</label>
        <ui-chip-list 
          [(ngModel)]="emails" 
          [placeholder]="placeholder"
          [variant]="variant"
        />
        <p class="mt-2 text-sm text-muted-foreground">
          Type an email and press Enter to add
        </p>
      </div>
    `,
    }),
};

export const CommaSeparated: Story = {
    args: {
        placeholder: 'Type tags (comma or enter to add)...',
        separatorKeys: [','],
    },
    render: (args) => ({
        props: {
            ...args,
            tags: [],
        },
        template: `
      <div class="w-[400px]">
        <ui-chip-list 
          [(ngModel)]="tags" 
          [placeholder]="placeholder"
          [separatorKeys]="separatorKeys"
          [variant]="variant"
        />
        <p class="mt-2 text-sm text-muted-foreground">
          Press Enter or type a comma to add tags
        </p>
      </div>
    `,
    }),
};
