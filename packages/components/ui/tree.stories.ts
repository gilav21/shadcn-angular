import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
    TreeComponent,
    TreeItemComponent,
    TreeLabelComponent,
    TreeIconComponent,
} from './tree.component';
import {
    ContextMenuComponent,
    ContextMenuTriggerDirective,
    ContextMenuContentComponent,
    ContextMenuItemComponent,
    ContextMenuShortcutComponent,
    ContextMenuSeparatorComponent,
} from './context-menu.component';
import { ContextMenuIntegrations } from './context-menu-integrations';

const meta: Meta = {
    title: 'UI/Tree',
    decorators: [
        moduleMetadata({
            imports: [TreeComponent, TreeItemComponent, TreeLabelComponent, TreeIconComponent],
        }),
    ],
    tags: ['autodocs'],
};

export default meta;

type Story = StoryObj;

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
            onContextMenuAction: (action: string, node: any) => {
                console.log(`Action: ${action}`, node);
                alert(`Action: ${action}\nNode: ${node?.label || 'Unknown'} (${node?.key || 'No Key'})`);
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
