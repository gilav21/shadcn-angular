import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  ContextMenuComponent,
  ContextMenuContentComponent,
  ContextMenuItemComponent,
  ContextMenuSeparatorComponent,
  ContextMenuShortcutComponent,
  ContextMenuIntegrations,
  ToastService,
  TreeComponent,
  TreeIconComponent,
  TreeItemComponent,
  TreeLabelComponent,
  TreeNode,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-tree-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TreeComponent,
    TreeItemComponent,
    TreeLabelComponent,
    TreeIconComponent,
    ContextMenuComponent,
    ContextMenuContentComponent,
    ContextMenuItemComponent,
    ContextMenuSeparatorComponent,
    ContextMenuShortcutComponent,
    ...ContextMenuIntegrations,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="tree" class="text-2xl font-semibold scroll-m-20">Tree</h2>
      <p class="text-muted-foreground">A hierarchical list of items.</p>

      <div class="max-w-sm border rounded-md p-4">
        <ui-tree [uiTreeContextMenu]="treeContextMenu">
          <ui-tree-item value="documents">
            <ui-tree-label>
              <ui-tree-icon>&#x1f4c1;</ui-tree-icon>
              Documents
            </ui-tree-label>
            <ui-tree-item value="resume">
              <ui-tree-label>
                <ui-tree-icon>&#x1f4c4;</ui-tree-icon>
                Resume.pdf
              </ui-tree-label>
            </ui-tree-item>
            <ui-tree-item value="cover-letter">
              <ui-tree-label>
                <ui-tree-icon>&#x1f4c4;</ui-tree-icon>
                Cover Letter.docx
              </ui-tree-label>
            </ui-tree-item>
          </ui-tree-item>
          <ui-tree-item value="images">
            <ui-tree-label>
              <ui-tree-icon>&#x1f4c1;</ui-tree-icon>
              Images
            </ui-tree-label>
            <ui-tree-item value="vacation">
              <ui-tree-label>
                <ui-tree-icon>&#x1f5bc;&#xfe0f;</ui-tree-icon>
                vacation.jpg
              </ui-tree-label>
            </ui-tree-item>
          </ui-tree-item>
        </ui-tree>

        <ui-context-menu #treeContextMenu>
          <ui-context-menu-content class="w-64">
            <ui-context-menu-item (click)="onTreeContextMenu('open', treeContextMenu.data())" (keydown.enter)="onTreeContextMenu('open', treeContextMenu.data())">
              Open
              <ui-context-menu-shortcut>&#x23ce;</ui-context-menu-shortcut>
            </ui-context-menu-item>
            <ui-context-menu-item (click)="onTreeContextMenu('properties', treeContextMenu.data())" (keydown.enter)="onTreeContextMenu('properties', treeContextMenu.data())">
              Properties
              <ui-context-menu-shortcut>&#8984;I</ui-context-menu-shortcut>
            </ui-context-menu-item>
            <ui-context-menu-separator />
            <ui-context-menu-item variant="destructive"
              (click)="onTreeContextMenu('delete', treeContextMenu.data())" (keydown.enter)="onTreeContextMenu('delete', treeContextMenu.data())">
              Delete
              <ui-context-menu-shortcut>&#8984;&#9003;</ui-context-menu-shortcut>
            </ui-context-menu-item>
          </ui-context-menu-content>
        </ui-context-menu>
      </div>

      <h3 class="text-lg font-medium pt-4">Data-Driven Mode</h3>
      <p class="text-sm text-muted-foreground">
        Using the <code>[data]</code> input with <code>[initialExpandDepth]="1"</code> to auto-expand the first level.
      </p>
      <div class="max-w-sm border rounded-md p-4">
        <ui-tree [data]="treeSelectNodes" [initialExpandDepth]="1" selectable="single" />
      </div>

      <h3 class="text-lg font-medium pt-4">Large Dataset (5 x 7 depth = 97,655 nodes)</h3>
      <p class="text-sm text-muted-foreground">
        Lazy rendering: only root nodes are in the DOM initially. Children render on expand.
      </p>
      <div class="max-w-md border rounded-md p-4 max-h-96 overflow-auto">
        <ui-tree [data]="largeTreeData()" selectable="single" />
      </div>
    </section>
  `,
})
export class TreeDemoComponent {
  private readonly toastService = inject(ToastService);

  readonly largeTreeData = signal<TreeNode[]>(this.generateDeepTree(5, 7));

  readonly treeSelectNodes: TreeNode[] = [
    {
      key: 'documents',
      label: 'Documents',
      icon: '\u{1f4c1}',
      children: [
        {
          key: 'work', label: 'Work', icon: '\u{1f4c2}', children: [
            { key: 'report', label: 'Report.docx', icon: '\u{1f4c4}' },
            { key: 'expenses', label: 'Expenses.xlsx', icon: '\u{1f4ca}' },
          ],
        },
        {
          key: 'personal', label: 'Personal', icon: '\u{1f4c2}', children: [
            { key: 'resume', label: 'Resume.pdf', icon: '\u{1f4c4}' },
          ],
        },
      ],
    },
    {
      key: 'images',
      label: 'Images',
      icon: '\u{1f5bc}\ufe0f',
      children: [
        {
          key: 'vacation', label: 'Vacation', children: [
            { key: 'beach', label: 'Beach.jpg', icon: '\u{1f4f7}' },
            { key: 'mountains', label: 'Mountains.jpg', icon: '\u{1f4f7}' },
          ],
        },
      ],
    },
  ];

  onTreeContextMenu(action: string, node: unknown): void {
    const label = (node as Record<string, unknown>)?.['label'] ?? 'Unknown';
    this.toastService.toast({
      title: 'Tree Context Menu Action',
      description: `Action: ${action} on node ${label}`,
      variant: 'default',
    });
  }

  private generateDeepTree(breadth: number, depth: number, prefix = 'node'): TreeNode[] {
    if (depth === 0) return [];
    const nodes: TreeNode[] = [];
    for (let i = 0; i < breadth; i++) {
      const key = `${prefix}-${i}`;
      const children = depth > 1 ? this.generateDeepTree(breadth, depth - 1, key) : undefined;
      nodes.push({
        key,
        label: key,
        icon: children ? '\u{1f4c1}' : '\u{1f4c4}',
        children,
      });
    }
    return nodes;
  }
}
