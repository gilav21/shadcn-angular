import { Meta, StoryObj, applicationConfig, moduleMetadata } from '@storybook/angular';
import { TreeSelectComponent } from './tree-select.component';
import { TreeNode, TreeComponent } from '../tree';
import { FormsModule } from '@angular/forms';
// eslint-disable-next-line sonarjs/deprecation -- provideNoopAnimations is deprecated in Angular 20.2; no stable animate.enter/leave replacement yet for Storybook setup
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { PopoverTriggerComponent, PopoverContentComponent } from '../popover';

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
        // eslint-disable-next-line sonarjs/deprecation -- provideNoopAnimations is deprecated in Angular 20.2; no stable replacement for Storybook providers yet
        applicationConfig({ providers: [provideNoopAnimations()] }),
        moduleMetadata({
            imports: [
                TreeSelectComponent,
                FormsModule,
                PopoverTriggerComponent,
                PopoverContentComponent,
                TreeComponent,
            ],
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

export const CustomMode: Story = {
    name: 'Custom Mode (Content Projection)',
    render: () => ({
        props: {
            nodes: SAMPLE_NODES,
            selectedLabel: 'Pick a file...',
            onTreeSelection(selection: string[]) {
                this['selectedLabel'] = selection[0] ?? 'Pick a file...';
            }
        },
        template: `
            <div class="h-[300px] w-full flex flex-col items-center pt-10 gap-4">
                <ui-tree-select class="w-[300px]">
                    <ui-popover-trigger class="w-full">
                        <button
                            type="button"
                            role="combobox"
                            class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        >
                            <span class="flex items-center gap-2 truncate text-left">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                                {{ selectedLabel }}
                            </span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 opacity-50"><path d="m6 9 6 6 6-6"/></svg>
                        </button>
                    </ui-popover-trigger>
                    <ui-popover-content class="w-[--trigger-width] p-2" align="start">
                        <ui-tree
                            [data]="nodes"
                            [selectable]="'single'"
                            class="w-full"
                            (selectionChange)="onTreeSelection($event)"
                        />
                    </ui-popover-content>
                </ui-tree-select>
                <p class="text-sm text-muted-foreground">Selected: {{ selectedLabel }}</p>
            </div>
        `,
    }),
};
