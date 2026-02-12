import { Meta, StoryObj } from '@storybook/angular';
import { TreeSelectComponent } from './tree-select.component';
import { TreeNode } from './tree.component';
import { moduleMetadata } from '@storybook/angular';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

const SAMPLE_NODES: TreeNode[] = [
    {
        key: 'documents',
        label: 'Documents',
        icon: 'folder',
        children: [
            {
                key: 'work',
                label: 'Work',
                icon: 'folder',
                children: [
                    { key: 'report', label: 'Annual Report.docx', icon: 'file' },
                    { key: 'expenses', label: 'Expenses.xlsx', icon: 'file' }
                ]
            },
            {
                key: 'personal',
                label: 'Personal',
                icon: 'folder',
                children: [
                    { key: 'resume', label: 'Resume.pdf', icon: 'file' },
                    { key: 'photos', label: 'Photos.zip', icon: 'file' }
                ]
            }
        ]
    },
    {
        key: 'projects',
        label: 'Projects',
        icon: 'folder',
        children: [
            { key: 'angular', label: 'Angular App', icon: 'code' },
            { key: 'react', label: 'React App', icon: 'code' }
        ]
    }
];

const meta: Meta<TreeSelectComponent> = {
    title: 'UI/TreeSelect',
    component: TreeSelectComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [TreeSelectComponent, FormsModule, NoopAnimationsModule],
        }),
    ],
    argTypes: {
        disabled: { control: 'boolean' },
        placeholder: { control: 'text' },
    },
    args: {
        nodes: SAMPLE_NODES,
        placeholder: 'Select an item...',
        disabled: false,
    },
};

export default meta;
type Story = StoryObj<TreeSelectComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="h-[300px] w-full flex justify-center pt-10">
                <ui-tree-select 
                    [nodes]="nodes"
                    [placeholder]="placeholder"
                    [disabled]="disabled"
                    class="w-[250px]"
                />
            </div>
        `,
    }),
};

export const WithPreselection: Story = {
    name: 'With Preselection',
    render: (args) => ({
        props: {
            ...args,
            value: 'report'
        },
        template: `
             <div class="h-[300px] w-full flex flex-col items-center pt-10 gap-4">
                <ui-tree-select 
                    [nodes]="nodes"
                    [placeholder]="placeholder"
                    [disabled]="disabled"
                    [(ngModel)]="value"
                    class="w-[250px]"
                />
                <p class="text-sm text-muted-foreground">Selected Key: {{ value }}</p>
            </div>
        `,
    }),
};

export const Disabled: Story = {
    args: {
        disabled: true,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="h-[300px] w-full flex justify-center pt-10">
                <ui-tree-select 
                    [nodes]="nodes"
                    [placeholder]="placeholder"
                    [disabled]="disabled"
                    class="w-[250px]"
                />
            </div>
        `,
    }),
};
