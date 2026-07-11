import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { TreeComponent, TreeNode } from './tree.component';
import { TreeItemComponent } from './sub/tree-item.component';
import { TreeLabelComponent } from './sub/tree-label.component';
import { TreeIconComponent } from './sub/tree-icon.component';
import {
    ContextMenuComponent,
    ContextMenuTriggerDirective,
    ContextMenuContentComponent,
    ContextMenuItemComponent,
    ContextMenuShortcutComponent,
    ContextMenuSeparatorComponent,
} from '../context-menu';
import { ContextMenuIntegrations } from '../context-menu-integrations';

const meta: Meta<TreeComponent> = {
    title: 'UI/Tree',
    component: TreeComponent,
    decorators: [
        moduleMetadata({
            imports: [TreeComponent, TreeItemComponent, TreeLabelComponent, TreeIconComponent],
        }),
    ],
    tags: ['autodocs'],
    argTypes: {
        selectable: {
            control: 'select',
            options: ['single', 'multiple', 'none'],
            description: 'Selection mode for tree items.',
        },
        data: { control: 'object', description: 'Data-driven node tree; when provided, renders nodes from data instead of projected ui-tree-item content.' },
        initialExpandDepth: { control: 'number', description: 'How many levels to auto-expand on load (data-driven mode). -1 expands all, 0 expands none.' },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        selectable: 'none',
        data: [],
        initialExpandDepth: 0,
        class: '',
    },
};

export default meta;

type Story = StoryObj<TreeComponent>;

const TEMPLATE = `
    <div class="max-w-full sm:max-w-sm border rounded-md p-4">
        <ui-tree [selectable]="selectable" [class]="class">
            <ui-tree-item value="documents">
                <ui-tree-label>
                    <ui-tree-icon>📁</ui-tree-icon>
                    Documents
                </ui-tree-label>
                <ui-tree-item value="resume">
                    <ui-tree-label>
                        <ui-tree-icon>📄</ui-tree-icon>
                        Resume.pdf
                    </ui-tree-label>
                </ui-tree-item>
                <ui-tree-item value="cover-letter">
                    <ui-tree-label>
                        <ui-tree-icon>📄</ui-tree-icon>
                        Cover Letter.docx
                    </ui-tree-label>
                </ui-tree-item>
            </ui-tree-item>
            <ui-tree-item value="images">
                <ui-tree-label>
                    <ui-tree-icon>📁</ui-tree-icon>
                    Images
                </ui-tree-label>
                <ui-tree-item value="vacation">
                    <ui-tree-label>
                        <ui-tree-icon>🖼️</ui-tree-icon>
                        vacation.jpg
                    </ui-tree-label>
                </ui-tree-item>
            </ui-tree-item>
        </ui-tree>
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = {
    render: () => ({
        template: `
            <div class="max-w-sm border rounded-md p-4">
                <ui-tree>
                    <ui-tree-item value="documents">
                        <ui-tree-label>
                            <ui-tree-icon>📁</ui-tree-icon>
                            Documents
                        </ui-tree-label>
                        <ui-tree-item value="resume">
                            <ui-tree-label>
                                <ui-tree-icon>📄</ui-tree-icon>
                                Resume.pdf
                            </ui-tree-label>
                        </ui-tree-item>
                        <ui-tree-item value="cover-letter">
                            <ui-tree-label>
                                <ui-tree-icon>📄</ui-tree-icon>
                                Cover Letter.docx
                            </ui-tree-label>
                        </ui-tree-item>
                    </ui-tree-item>
                    <ui-tree-item value="images">
                        <ui-tree-label>
                            <ui-tree-icon>📁</ui-tree-icon>
                            Images
                        </ui-tree-label>
                        <ui-tree-item value="vacation">
                            <ui-tree-label>
                                <ui-tree-icon>🖼️</ui-tree-icon>
                                vacation.jpg
                            </ui-tree-label>
                        </ui-tree-item>
                    </ui-tree-item>
                </ui-tree>
            </div>
        `,
    }),
};

export const SingleSelection: Story = {
    render: () => ({
        template: `
            <div class="max-w-sm border rounded-md p-4">
                <ui-tree selectable="single">
                    <ui-tree-item value="src">
                        <ui-tree-label>
                            <ui-tree-icon>📁</ui-tree-icon>
                            src
                        </ui-tree-label>
                        <ui-tree-item value="components">
                            <ui-tree-label>
                                <ui-tree-icon>📁</ui-tree-icon>
                                components
                            </ui-tree-label>
                            <ui-tree-item value="button">
                                <ui-tree-label>button.ts</ui-tree-label>
                            </ui-tree-item>
                            <ui-tree-item value="input">
                                <ui-tree-label>input.ts</ui-tree-label>
                            </ui-tree-item>
                        </ui-tree-item>
                        <ui-tree-item value="utils">
                            <ui-tree-label>utils.ts</ui-tree-label>
                        </ui-tree-item>
                    </ui-tree-item>
                </ui-tree>
            </div>
        `,
    }),
};

export const MultipleSelection: Story = {
    render: () => ({
        template: `
            <div class="max-w-sm border rounded-md p-4">
                <ui-tree selectable="multiple">
                    <ui-tree-item value="framework-1">
                        <ui-tree-label>Angular</ui-tree-label>
                    </ui-tree-item>
                    <ui-tree-item value="framework-2">
                        <ui-tree-label>React</ui-tree-label>
                    </ui-tree-item>
                    <ui-tree-item value="framework-3">
                        <ui-tree-label>Vue</ui-tree-label>
                    </ui-tree-item>
                    <ui-tree-item value="framework-4">
                        <ui-tree-label>Svelte</ui-tree-label>
                    </ui-tree-item>
                </ui-tree>
            </div>
        `,
    }),
};

export const RTL: Story = {
    render: () => ({
        template: `
            <div dir="rtl" class="max-w-sm border rounded-md p-4">
                <ui-tree selectable="single">
                    <ui-tree-item value="مجلد-1">
                        <ui-tree-label>
                            <ui-tree-icon>📁</ui-tree-icon>
                            المستندات
                        </ui-tree-label>
                        <ui-tree-item value="ملف-1">
                            <ui-tree-label>
                                <ui-tree-icon>📄</ui-tree-icon>
                                السيرة الذاتية
                            </ui-tree-label>
                        </ui-tree-item>
                        <ui-tree-item value="ملف-2">
                            <ui-tree-label>
                                <ui-tree-icon>📄</ui-tree-icon>
                                خطاب التغطية
                            </ui-tree-label>
                        </ui-tree-item>
                    </ui-tree-item>
                </ui-tree>
            </div>
        `,
    }),
};

export const WithContextMenu: Story = {
    render: (args) => ({
        props: {
            ...args,
            onContextMenuAction: (action: string, node: { label?: string; key?: string }) => {
                alert(`Action: ${action}\nNode: ${node?.label ?? 'Unknown'} (${node?.key ?? 'No Key'})`);
            }
        },
        moduleMetadata: {
            imports: [
                ContextMenuComponent,
                ContextMenuTriggerDirective,
                ContextMenuContentComponent,
                ContextMenuItemComponent,
                ContextMenuShortcutComponent,
                ContextMenuSeparatorComponent,
                ...ContextMenuIntegrations
            ]
        },
        template: `
            <div class="max-w-sm border rounded-md p-4">
                <ui-tree [uiTreeContextMenu]="treeContextMenu">
                    <ui-tree-item value="documents">
                        <ui-tree-label>
                            <ui-tree-icon>📁</ui-tree-icon>
                            Documents
                        </ui-tree-label>
                        <ui-tree-item value="resume">
                            <ui-tree-label>
                                <ui-tree-icon>📄</ui-tree-icon>
                                Resume.pdf
                            </ui-tree-label>
                        </ui-tree-item>
                        <ui-tree-item value="cover-letter">
                            <ui-tree-label>
                                <ui-tree-icon>📄</ui-tree-icon>
                                Cover Letter.docx
                            </ui-tree-label>
                        </ui-tree-item>
                    </ui-tree-item>
                    <ui-tree-item value="images">
                        <ui-tree-label>
                            <ui-tree-icon>📁</ui-tree-icon>
                            Images
                        </ui-tree-label>
                        <ui-tree-item value="vacation">
                            <ui-tree-label>
                                <ui-tree-icon>🖼️</ui-tree-icon>
                                vacation.jpg
                            </ui-tree-label>
                        </ui-tree-item>
                    </ui-tree-item>
                </ui-tree>

                <ui-context-menu #treeContextMenu>
                    <ui-context-menu-content class="w-64">
                        <ui-context-menu-item (click)="onContextMenuAction('open', treeContextMenu.data())">
                            Open
                            <ui-context-menu-shortcut>⏎</ui-context-menu-shortcut>
                        </ui-context-menu-item>
                        <ui-context-menu-item (click)="onContextMenuAction('properties', treeContextMenu.data())">
                            Properties
                            <ui-context-menu-shortcut>⌘I</ui-context-menu-shortcut>
                        </ui-context-menu-item>
                        <ui-context-menu-separator />
                        <ui-context-menu-item variant="destructive" (click)="onContextMenuAction('delete', treeContextMenu.data())">
                            Delete
                            <ui-context-menu-shortcut>⌘⌫</ui-context-menu-shortcut>
                        </ui-context-menu-item>
                    </ui-context-menu-content>
                </ui-context-menu>
            </div>
        `,
    }),
};

const sampleTreeData: TreeNode[] = [
    {
        key: 'src',
        label: 'src',
        icon: '📁',
        children: [
            {
                key: 'components',
                label: 'components',
                icon: '📁',
                children: [
                    { key: 'button.ts', label: 'button.ts', icon: '📄' },
                    { key: 'input.ts', label: 'input.ts', icon: '📄' },
                    { key: 'tree.ts', label: 'tree.ts', icon: '📄' },
                ],
            },
            {
                key: 'utils',
                label: 'utils',
                icon: '📁',
                children: [
                    { key: 'cn.ts', label: 'cn.ts', icon: '📄' },
                ],
            },
            { key: 'main.ts', label: 'main.ts', icon: '📄' },
        ],
    },
    {
        key: 'docs',
        label: 'docs',
        icon: '📁',
        children: [
            { key: 'readme.md', label: 'README.md', icon: '📄' },
        ],
    },
    { key: 'package.json', label: 'package.json', icon: '📄' },
];

export const DataDriven: Story = {
    render: () => ({
        props: { data: sampleTreeData },
        template: `
            <div class="max-w-sm border rounded-md p-4">
                <ui-tree [data]="data" selectable="single" />
            </div>
        `,
    }),
};

export const DataDrivenWithInitialExpand: Story = {
    render: () => ({
        props: { data: sampleTreeData },
        template: `
            <div class="max-w-sm border rounded-md p-4">
                <ui-tree [data]="data" [initialExpandDepth]="1" selectable="single" />
            </div>
        `,
    }),
};

function generateLargeTree(breadth: number, depth: number, prefix = 'node'): TreeNode[] {
    if (depth === 0) return [];
    const nodes: TreeNode[] = [];
    for (let i = 0; i < breadth; i++) {
        const key = `${prefix}-${i}`;
        const children = depth > 1 ? generateLargeTree(breadth, depth - 1, key) : undefined;
        nodes.push({
            key,
            label: key,
            icon: children ? '📁' : '📄',
            children,
        });
    }
    return nodes;
}

const largeTreeData = generateLargeTree(10, 3);

export const LargeDataset: Story = {
    render: () => ({
        props: { data: largeTreeData },
        template: `
            <div class="max-w-md border rounded-md p-4 max-h-96 overflow-auto">
                <p class="text-xs text-muted-foreground mb-2">1,110 nodes — only root level rendered initially</p>
                <ui-tree [data]="data" selectable="single" />
            </div>
        `,
    }),
};
