import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { TREE_VIEW_DEMO_LOCALES } from './tree-view-demo.locales';

@Component({
  selector: 'app-tree-view-demo',
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
      <h2 id="tree-view" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="rounded-md border p-4 max-w-sm">
        <ui-tree selectable="single">
          <ui-tree-item value="documents">
            <ui-tree-label>
              <ui-tree-icon>&#x1f4c1;</ui-tree-icon>
              {{ t().folderDocuments }}
            </ui-tree-label>
            <ui-tree-item value="resume">
              <ui-tree-label>
                <ui-tree-icon>&#x1f4c4;</ui-tree-icon>
                {{ t().fileResume }}
              </ui-tree-label>
            </ui-tree-item>
            <ui-tree-item value="cover-letter">
              <ui-tree-label>
                <ui-tree-icon>&#x1f4c4;</ui-tree-icon>
                {{ t().fileCoverLetter }}
              </ui-tree-label>
            </ui-tree-item>
          </ui-tree-item>
          <ui-tree-item value="images">
            <ui-tree-label>
              <ui-tree-icon>&#x1f4c1;</ui-tree-icon>
              {{ t().folderImages }}
            </ui-tree-label>
            <ui-tree-item value="photo1">
              <ui-tree-label>
                <ui-tree-icon>&#x1f5bc;&#xfe0f;</ui-tree-icon>
                {{ t().fileVacation }}
              </ui-tree-label>
            </ui-tree-item>
          </ui-tree-item>
        </ui-tree>
      </div>

      <h3 class="text-lg font-medium mt-8">{{ t().simpleHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().simpleDescription }}</p>
      <ui-tree [data]="simpleTreeNodes()" />

      <h3 class="text-lg font-medium mt-8">{{ t().contextMenuHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().contextMenuDescription }}</p>
      <div class="max-w-sm border rounded-md p-4">
        <ui-tree [uiTreeContextMenu]="treeContextMenu">
          <ui-tree-item value="documents-cm">
            <ui-tree-label>
              <ui-tree-icon>&#x1f4c1;</ui-tree-icon>
              {{ t().folderDocuments }}
            </ui-tree-label>
            <ui-tree-item value="resume-cm">
              <ui-tree-label>
                <ui-tree-icon>&#x1f4c4;</ui-tree-icon>
                {{ t().fileResume }}
              </ui-tree-label>
            </ui-tree-item>
            <ui-tree-item value="cover-letter-cm">
              <ui-tree-label>
                <ui-tree-icon>&#x1f4c4;</ui-tree-icon>
                {{ t().fileCoverLetter }}
              </ui-tree-label>
            </ui-tree-item>
          </ui-tree-item>
          <ui-tree-item value="images-cm">
            <ui-tree-label>
              <ui-tree-icon>&#x1f4c1;</ui-tree-icon>
              {{ t().folderImages }}
            </ui-tree-label>
            <ui-tree-item value="vacation-cm">
              <ui-tree-label>
                <ui-tree-icon>&#x1f5bc;&#xfe0f;</ui-tree-icon>
                {{ t().fileVacation }}
              </ui-tree-label>
            </ui-tree-item>
          </ui-tree-item>
        </ui-tree>

        <ui-context-menu #treeContextMenu>
          <ui-context-menu-content class="w-64">
            <ui-context-menu-item
              (click)="onTreeContextMenu('open', treeContextMenu.data())"
              (keydown.enter)="onTreeContextMenu('open', treeContextMenu.data())">
              {{ t().menuOpen }}
              <ui-context-menu-shortcut>&#x23ce;</ui-context-menu-shortcut>
            </ui-context-menu-item>
            <ui-context-menu-item
              (click)="onTreeContextMenu('properties', treeContextMenu.data())"
              (keydown.enter)="onTreeContextMenu('properties', treeContextMenu.data())">
              {{ t().menuProperties }}
              <ui-context-menu-shortcut>&#8984;I</ui-context-menu-shortcut>
            </ui-context-menu-item>
            <ui-context-menu-separator />
            <ui-context-menu-item variant="destructive"
              (click)="onTreeContextMenu('delete', treeContextMenu.data())"
              (keydown.enter)="onTreeContextMenu('delete', treeContextMenu.data())">
              {{ t().menuDelete }}
              <ui-context-menu-shortcut>&#8984;&#9003;</ui-context-menu-shortcut>
            </ui-context-menu-item>
          </ui-context-menu-content>
        </ui-context-menu>
      </div>

      <h3 class="text-lg font-medium mt-8">{{ t().expandDepthHeading }}</h3>
      <p class="text-sm text-muted-foreground">{{ t().expandDepthDescription }}</p>
      <div class="max-w-sm border rounded-md p-4">
        <ui-tree [data]="treeSelectNodes()" [initialExpandDepth]="1" selectable="single" />
      </div>

      <h3 class="text-lg font-medium mt-8">{{ t().largeDatasetHeading }}</h3>
      <p class="text-sm text-muted-foreground">{{ t().largeDatasetDescription }}</p>
      <div class="max-w-md border rounded-md p-4 max-h-96 overflow-auto">
        <ui-tree [data]="largeTreeData()" selectable="single" />
      </div>
    </section>
  `,
})
export class TreeViewDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  private readonly toastService = inject(ToastService);
  readonly t = computed(() => TREE_VIEW_DEMO_LOCALES[this.localeId()] ?? TREE_VIEW_DEMO_LOCALES['en']);

  readonly largeTreeData = signal<TreeNode[]>(this.generateDeepTree(5, 7));

  readonly simpleTreeNodes = computed<TreeNode[]>(() => {
    const locale = this.t();
    return [
      { key: '1', label: locale.nodeProjects, children: [
          { key: '1-1', label: locale.nodeFrontend, children: [
              { key: '1-1-1', label: 'app.component.ts', icon: '\u{1f4c4}' },
              { key: '1-1-2', label: 'app.html', icon: '\u{1f4c4}' },
          ]},
          { key: '1-2', label: locale.nodeBackend },
      ]},
      { key: '2', label: locale.nodeSettings, icon: '⚙️' },
    ];
  });

  readonly treeSelectNodes = computed<TreeNode[]>(() => {
    const locale = this.t();
    return [
      {
        key: 'documents',
        label: locale.folderDocuments,
        icon: '\u{1f4c1}',
        children: [
          {
            key: 'work', label: locale.nodeWork, icon: '\u{1f4c2}', children: [
              { key: 'report', label: locale.nodeReport, icon: '\u{1f4c4}' },
              { key: 'expenses', label: locale.nodeExpenses, icon: '\u{1f4ca}' },
            ],
          },
          {
            key: 'personal', label: locale.nodePersonal, icon: '\u{1f4c2}', children: [
              { key: 'resume', label: locale.fileResume, icon: '\u{1f4c4}' },
            ],
          },
        ],
      },
      {
        key: 'images',
        label: locale.folderImages,
        icon: '\u{1f5bc}️',
        children: [
          {
            key: 'vacation', label: locale.nodeVacation, children: [
              { key: 'beach', label: locale.nodeBeach, icon: '\u{1f4f7}' },
              { key: 'mountains', label: locale.nodeMountains, icon: '\u{1f4f7}' },
            ],
          },
        ],
      },
    ];
  });

  onTreeContextMenu(action: string, node: unknown): void {
    const rawLabel = (node as Record<string, unknown>)?.['label'];
    const label = typeof rawLabel === 'string' ? rawLabel : 'Unknown';
    const locale = this.t();
    this.toastService.toast({
      title: locale.toastTitle,
      description: locale.toastDescription.replace('{action}', action).replace('{label}', label),
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
