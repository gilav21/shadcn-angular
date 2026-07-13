import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { TreeComponent, type TreeNode } from '@/components/ui/tree';
import {
    ContextMenuComponent,
    type ContextMenuItem,
} from '@/components/ui/context-menu';
import {
    TreeContextMenuDirective,
    type TreeContextMenuEvent,
} from '@/components/ui/tree-context-menu.directive';

/**
 * Harness for the `tree-context-menu` directive
 * (`selector: 'ui-tree[uiTreeContextMenu]'`), so the spec installs `tree`
 * alongside it — the registry entry does not list `tree` as a dependency.
 */
@Component({
    selector: 'app-tree-context-menu-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TreeComponent, ContextMenuComponent, TreeContextMenuDirective],
    template: `
        <main class="p-8">
            <ui-context-menu #menu [items]="items" />

            <ui-tree
                data-testid="root"
                class="block w-64"
                [data]="nodes"
                [initialExpandDepth]="2"
                [uiTreeContextMenu]="menu"
                (nodeContextMenu)="onNode($event)"
            />
            <p data-testid="node">{{ node() }}</p>
        </main>
    `,
})
export class TreeContextMenuDemoComponent {
    readonly menu = viewChild.required<ContextMenuComponent>('menu');
    readonly node = signal('');

    readonly nodes: TreeNode[] = [
        {
            key: 'src',
            label: 'src',
            children: [
                { key: 'app', label: 'app.ts' },
                { key: 'main', label: 'main.ts' },
            ],
        },
    ];

    readonly items: ContextMenuItem[] = [{ label: 'Rename' }, { label: 'Delete' }];

    onNode(event: TreeContextMenuEvent): void {
        this.node.set(JSON.stringify(event.node).slice(0, 60));
    }
}
