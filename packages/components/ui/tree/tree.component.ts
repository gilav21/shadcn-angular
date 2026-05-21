import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    inject,
    InjectionToken,
    forwardRef,
    contentChild,
    output,
    ElementRef,
    viewChild,
    effect
} from '@angular/core';
import { cn, isRtl } from '../../lib/utils';
import { NgTemplateOutlet } from '@angular/common';
import { TreeItemComponent } from './sub/tree-item.component';
import { TreeLabelComponent } from './sub/tree-label.component';
import { TreeIconComponent } from './sub/tree-icon.component';
import { TreeNodeContentDirective } from './sub/tree-node-content.directive';


export interface TreeNode {
    key: string;
    label: string;
    icon?: string;
    children?: TreeNode[];
    data?: unknown;
}

export const TREE = new InjectionToken<TreeComponent>('TREE');

@Component({
    selector: 'ui-tree',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [{ provide: TREE, useExisting: forwardRef(() => TreeComponent) }],
    templateUrl: './tree.component.html',
    host: { class: 'block' },
    imports: [
        NgTemplateOutlet,
        forwardRef(() => TreeItemComponent),
        forwardRef(() => TreeLabelComponent),
        forwardRef(() => TreeIconComponent),
    ],
})
export class TreeComponent {
    class = input('');
    selectable = input<'single' | 'multiple' | 'none'>('none');
    data = input<TreeNode[]>([]);
    initialExpandDepth = input<number>(0);

    readonly nodeContent = contentChild(TreeNodeContentDirective);


    expandedKeys = signal<Set<string>>(new Set());
    selectedKeys = signal<Set<string>>(new Set());
    focusedKey = signal<string | null>(null);

    selectionChange = output<string[]>();
    expandChange = output<string[]>();

    treeRoot = viewChild<ElementRef<HTMLElement>>('treeRoot');
    items = signal<TreeItemComponent[]>([]);
    private readonly _itemRegistry = new Set<TreeItemComponent>();
    private _updateScheduled = false;

    private readonly el = inject(ElementRef);

    constructor() {
        effect(() => {
            const nodes = this.data();
            const depth = this.initialExpandDepth();
            this.ancestorCache.clear();

            if (nodes.length > 0 && depth !== 0) {
                const keys = this.collectKeysToDepth(nodes, depth);
                this.expandedKeys.set(keys);
                this.expandChange.emit(Array.from(keys));
            }
        });
    }

    private collectKeysToDepth(nodes: TreeNode[], maxDepth: number): Set<string> {
        const keys = new Set<string>();
        const traverse = (list: TreeNode[], currentDepth: number) => {
            for (const node of list) {
                if (node.children && node.children.length > 0) {
                    if (maxDepth === -1 || currentDepth < maxDepth) {
                        keys.add(node.key);
                        traverse(node.children, currentDepth + 1);
                    }
                }
            }
        };
        traverse(nodes, 0);
        return keys;
    }

    activeDescendantId = computed(() => {
        const focused = this.focusedKey();
        if (!focused) return null;
        return this.items().find(item => item.value() === focused)?.id() ?? null;
    });

    isRtl() {
        return isRtl(this.el.nativeElement);
    }

    classes = computed(() =>
        cn(
            'text-sm outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md',
            this.class()
        )
    );

    toggleExpanded(key: string) {
        const current = this.expandedKeys();
        const next = new Set(current);
        if (next.has(key)) {
            next.delete(key);
        } else {
            next.add(key);
        }
        this.expandedKeys.set(next);
        this.expandChange.emit(Array.from(next));
    }

    isExpanded(key: string): boolean {
        return this.expandedKeys().has(key);
    }

    toggleSelected(key: string) {
        if (this.selectable() === 'none') return;

        const current = this.selectedKeys();
        const next = new Set(this.selectable() === 'single' ? [] : current);

        if (current.has(key)) {
            next.delete(key);
        } else {
            next.add(key);
        }
        this.selectedKeys.set(next);
        this.selectionChange.emit(Array.from(next));
    }

    isSelected(key: string): boolean {
        return this.selectedKeys().has(key);
    }

    isFocused(key: string): boolean {
        return this.focusedKey() === key;
    }

    expandAll(keys: string[]) {
        this.expandedKeys.set(new Set(keys));
        this.expandChange.emit(keys);
    }

    collapseAll() {
        this.expandedKeys.set(new Set());
        this.expandChange.emit([]);
    }

    focus(key?: string | null) {
        if (key) {
            this.focusedKey.set(key);
        } else if (!this.focusedKey() && this.items().length > 0) {
            // Default to first item if nothing triggered
            this.focusedKey.set(this.items()[0].value());
        }
        this.treeRoot()?.nativeElement.focus();
    }

    registerItem(item: TreeItemComponent) {
        this._itemRegistry.add(item);
        this.scheduleItemsUpdate();
    }

    unregisterItem(item: TreeItemComponent) {
        this._itemRegistry.delete(item);
        this.scheduleItemsUpdate();
    }

    private scheduleItemsUpdate() {
        if (this._updateScheduled) return;
        this._updateScheduled = true;
        queueMicrotask(() => {
            this._updateScheduled = false;
            this.updateItemsList();
        });
    }

    private readonly flattenedKeys = computed(() => {
        const nodes = this.data();
        if (nodes.length === 0) return null;

        const keyMap = new Map<string, number>();
        let index = 0;

        const traverse = (list: TreeNode[]) => {
            for (const node of list) {
                keyMap.set(node.key, index++);
                if (node.children) {
                    traverse(node.children);
                }
            }
        };

        traverse(nodes);
        return keyMap;
    });

    private readonly parentMap = computed(() => {
        const nodes = this.data();
        if (nodes.length === 0) return null;

        const map = new Map<string, string>();

        const traverse = (list: TreeNode[], parentKey?: string) => {
            for (const node of list) {
                if (parentKey) {
                    map.set(node.key, parentKey);
                }
                if (node.children) {
                    traverse(node.children, node.key);
                }
            }
        };

        traverse(nodes);
        return map;
    });

    private readonly ancestorCache = new Map<string, string[]>();

    private getAncestors(key: string): string[] {
        if (this.ancestorCache.has(key)) {
            return this.ancestorCache.get(key)!;
        }

        const ancestors: string[] = [];
        const parentMap = this.parentMap();

        if (parentMap) {
            let current = key;
            while (true) {
                const parent = parentMap.get(current);
                if (!parent) break;
                ancestors.push(parent);
                current = parent;
            }
        } else {
            const item = this.items().find(i => i.value() === key);
            let current = item?.parentItem;
            while (current) {
                ancestors.push(current.value());
                current = current.parentItem;
            }
        }

        this.ancestorCache.set(key, ancestors);
        return ancestors;
    }

    private isItemVisible(key: string): boolean {
        const ancestors = this.getAncestors(key);
        return ancestors.every(ancestor => this.isExpanded(ancestor));
    }

    private updateItemsList() {
        const arr = Array.from(this._itemRegistry);
        const orderMap = this.flattenedKeys();

        if (orderMap) {
            arr.sort((a, b) => {
                const indexA = orderMap.get(a.value()) ?? Infinity;
                const indexB = orderMap.get(b.value()) ?? Infinity;
                return indexA - indexB;
            });
        } else if (arr.length > 1) {
            arr.sort((a, b) => {
                const pos = a.elementRef.nativeElement.compareDocumentPosition(b.elementRef.nativeElement);
                return (pos & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
            });
        }
        this.items.set(arr);
    }

    private getVisibleItems(): readonly TreeItemComponent[] {
        return this.items().filter(item => this.isItemVisible(item.value()));
    }

    onKeydown(event: KeyboardEvent) {
        const items = this.getVisibleItems();
        if (items.length === 0) return;

        const currentFocus = this.focusedKey();
        const itemValues = items.map(i => i.value());
        const currentIndex = currentFocus ? itemValues.indexOf(currentFocus) : -1;

        const expandKey = this.isRtl() ? 'ArrowLeft' : 'ArrowRight';
        const collapseKey = this.isRtl() ? 'ArrowRight' : 'ArrowLeft';

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.handleArrowDown(itemValues, currentIndex, items.length);
                break;

            case 'ArrowUp':
                event.preventDefault();
                this.handleArrowUp(itemValues, currentIndex, items.length);
                break;

            case expandKey:
                event.preventDefault();
                this.handleExpand(items, itemValues, currentFocus, currentIndex);
                break;

            case collapseKey:
                event.preventDefault();
                this.handleCollapse(items, currentFocus);
                break;

            case 'Enter':
            case ' ':
                event.preventDefault();
                if (currentFocus) {
                    this.toggleSelected(currentFocus);
                }
                break;

            case 'Home':
                event.preventDefault();
                if (items.length > 0) {
                    this.focusedKey.set(itemValues[0]);
                }
                break;

            case 'End':
                event.preventDefault();
                if (items.length > 0) {
                    this.focusedKey.set(itemValues.at(-1)!);
                }
                break;

            case '*':
                event.preventDefault();
                this.expandAllCollapsed(items);
                break;
        }
    }

    private handleArrowDown(itemValues: string[], currentIndex: number, totalItems: number) {
        if (currentIndex < totalItems - 1) {
            this.focusedKey.set(itemValues[currentIndex + 1]);
        } else if (currentIndex === -1 && totalItems > 0) {
            this.focusedKey.set(itemValues[0]);
        }
    }

    private handleArrowUp(itemValues: string[], currentIndex: number, totalItems: number) {
        if (currentIndex > 0) {
            this.focusedKey.set(itemValues[currentIndex - 1]);
        } else if (currentIndex === -1 && totalItems > 0) {
            this.focusedKey.set(itemValues.at(-1)!);
        }
    }

    private handleExpand(
        items: readonly TreeItemComponent[],
        itemValues: string[],
        currentFocus: string | null,
        currentIndex: number
    ) {
        if (!currentFocus) return;
        const item = items.find(i => i.value() === currentFocus);
        if (!item?.hasChildren()) return;

        if (this.isExpanded(currentFocus)) {
            const childIndex = currentIndex + 1;
            if (childIndex < items.length) {
                this.focusedKey.set(itemValues[childIndex]);
            }
        } else {
            this.toggleExpanded(currentFocus);
        }
    }

    private handleCollapse(items: readonly TreeItemComponent[], currentFocus: string | null) {
        if (!currentFocus) return;

        if (this.isExpanded(currentFocus)) {
            this.toggleExpanded(currentFocus);
            return;
        }

        const currentItem = items.find(i => i.value() === currentFocus);
        const parentKey = currentItem?.parentItem?.value() ?? this.parentMap()?.get(currentFocus);
        if (parentKey) {
            this.focusedKey.set(parentKey);
            if (this.isExpanded(parentKey)) {
                this.toggleExpanded(parentKey);
            }
        }
    }

    private expandAllCollapsed(items: readonly TreeItemComponent[]) {
        const current = this.expandedKeys();
        const next = new Set(current);
        let changed = false;
        for (const item of items) {
            if (item.hasChildren() && !next.has(item.value())) {
                next.add(item.value());
                changed = true;
            }
        }
        if (changed) {
            this.expandedKeys.set(next);
            this.expandChange.emit(Array.from(next));
        }
    }
}
