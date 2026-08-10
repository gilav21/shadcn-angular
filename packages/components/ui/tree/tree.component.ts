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
    /** Extra classes merged onto the `role="tree"` root, after the base sizing/focus-ring classes. */
    class = input('');
    /**
     * Selection mode. `'none'` (default) makes {@link toggleSelected} a no-op and
     * omits `aria-selected` from every item; `'single'` clears the previous key
     * before adding the new one; `'multiple'` accumulates keys and sets
     * `aria-multiselectable` on the root.
     */
    selectable = input<'single' | 'multiple' | 'none'>('none');
    /**
     * Data-driven nodes. When non-empty the component renders the whole tree itself
     * and any projected content is ignored; pass `[]` (the default) to hand-author
     * `<ui-tree-item>` children instead. Nodes are matched by `key`, which is what
     * {@link selectionChange} and {@link expandChange} emit.
     */
    data = input<TreeNode[]>([]);
    /**
     * Levels of {@link data} expanded on load: `0` (default) leaves everything collapsed,
     * `n` expands parents down to depth `n`, `-1` expands every level. Re-applied — and
     * re-emitted through {@link expandChange} — whenever `data` changes, discarding the
     * user's current expansion.
     */
    initialExpandDepth = input<number>(0);

    readonly nodeContent = contentChild(TreeNodeContentDirective);


    expandedKeys = signal<Set<string>>(new Set());
    selectedKeys = signal<Set<string>>(new Set());
    focusedKey = signal<string | null>(null);

    /**
     * Emits the full set of selected node keys after every selection change — not just
     * the key that changed — so a `'single'` tree emits a 0- or 1-element array. Never
     * emits while {@link selectable} is `'none'`.
     */
    selectionChange = output<string[]>();
    /**
     * Emits the full set of expanded node keys after every expand/collapse, including the
     * initial expansion driven by {@link initialExpandDepth} and the `*` keyboard shortcut.
     * Expansion state is owned by the component; this output is a notification, not a
     * two-way binding — drive it back only through {@link expandAll} / {@link collapseAll}.
     */
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
        const traverse = (list: TreeNode[], currentDepth: number): void => {
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

    /**
     * Whether the tree's host element resolves to a right-to-left direction. Read by
     * {@link onKeydown} to swap the expand/collapse arrow keys and by each item to flip
     * the collapsed chevron.
     */
    isRtl(): boolean {
        return isRtl(this.el.nativeElement);
    }

    classes = computed(() =>
        cn(
            'text-sm outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md',
            this.class()
        )
    );

    /**
     * Expands the node if collapsed, collapses it otherwise, then emits {@link expandChange}.
     * Collapsing a node keeps its descendants' own expanded flags — they are merely hidden,
     * and reappear expanded when the ancestor is re-opened. Does not affect selection or focus.
     */
    toggleExpanded(key: string): void {
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

    /**
     * Whether this node's own expanded flag is set. Reports `true` even when an ancestor is
     * collapsed and the node is therefore off-screen — it is not a visibility check.
     */
    isExpanded(key: string): boolean {
        return this.expandedKeys().has(key);
    }

    /**
     * Adds the key to the selection, or removes it if already selected, then emits
     * {@link selectionChange}. Does nothing while {@link selectable} is `'none'`. In
     * `'single'` mode any previously selected key is dropped. Parent nodes are selectable
     * like any other node — selecting one does not cascade to its children.
     */
    toggleSelected(key: string): void {
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

    /** Whether the node is in the current selection; always `false` while {@link selectable} is `'none'`. */
    isSelected(key: string): boolean {
        return this.selectedKeys().has(key);
    }

    /**
     * Whether the node is the tree's roving `aria-activedescendant` target. At most one node
     * is focused, and it is independent of selection — arrowing moves focus without selecting.
     */
    isFocused(key: string): boolean {
        return this.focusedKey() === key;
    }

    /**
     * Replaces the expanded set with exactly `keys` and emits {@link expandChange}. Despite the
     * name it does not walk {@link data} — any key you omit ends up collapsed, so pass every
     * parent key you want open.
     */
    expandAll(keys: string[]): void {
        this.expandedKeys.set(new Set(keys));
        this.expandChange.emit(keys);
    }

    /**
     * Collapses every expanded node, including ones currently scrolled or hidden out of view,
     * and emits an empty {@link expandChange}. Leaves selection and the focused key untouched,
     * so focus can remain on a node that is no longer visible.
     */
    collapseAll(): void {
        this.expandedKeys.set(new Set());
        this.expandChange.emit([]);
    }

    /**
     * Moves DOM focus to the tree root so it starts receiving {@link onKeydown}, and points the
     * roving `aria-activedescendant` at `key`. Called with no key it keeps an existing focused
     * node, or falls back to the first registered item. The key is not validated against
     * {@link data} and does not scroll or expand ancestors, so passing a hidden node's key
     * leaves nothing visibly focused. Does not select anything — see {@link toggleSelected}.
     */
    focus(key?: string | null): void {
        if (key) {
            this.focusedKey.set(key);
        } else if (!this.focusedKey() && this.items().length > 0) {
            // Default to first item if nothing triggered
            this.focusedKey.set(this.items()[0].value());
        }
        this.treeRoot()?.nativeElement.focus();
    }

    /**
     * Internal parent/child contract: each `<ui-tree-item>` calls this on itself from its own
     * constructor effect to join the keyboard-navigation order. Consumers should never call it —
     * registration is automatic for both projected and {@link data}-rendered items. The registry
     * is re-sorted into document/`data` order in a microtask, so {@link items} lags a newly added
     * item by one tick. Pair with {@link unregisterItem}.
     */
    registerItem(item: TreeItemComponent): void {
        this._itemRegistry.add(item);
        this.scheduleItemsUpdate();
    }

    /**
     * Counterpart to {@link registerItem}, invoked automatically when an item is destroyed.
     * Not for consumer use. Removing an item does not clear its key from the expanded,
     * selected, or focused state — that state survives until the key is toggled again.
     */
    unregisterItem(item: TreeItemComponent): void {
        this._itemRegistry.delete(item);
        this.scheduleItemsUpdate();
    }

    private scheduleItemsUpdate(): void {
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

        const traverse = (list: TreeNode[]): void => {
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

        const traverse = (list: TreeNode[], parentKey?: string): void => {
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
        const cached = this.ancestorCache.get(key);
        if (cached !== undefined) {
            return cached;
        }

        const ancestors: string[] = [];
        const parentMap = this.parentMap();

        if (parentMap) {
            let current = key;
            for (;;) {
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

    private updateItemsList(): void {
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

    /**
     * Bound to the tree root's `keydown`; the whole tree is one tab stop and navigation is
     * roving via `aria-activedescendant`. Up/Down move focus through *visible* nodes only
     * (descendants of collapsed parents are skipped), wrapping nowhere — Up from nothing
     * focused jumps to the last node. Home/End go to the first/last visible node.
     * Enter and Space run {@link toggleSelected} on the focused node. `*` expands every
     * visible node that has children. The expand/collapse arrows are direction-aware
     * ({@link isRtl}): in LTR, Right expands a collapsed parent then steps into its first
     * child, and Left collapses an open node or otherwise walks up to the parent; RTL swaps
     * the two. There is no typeahead. Note it calls `preventDefault()` on every keydown it
     * receives, including keys it does not handle.
     */
    onKeydown(event: KeyboardEvent): void {
        const items = this.getVisibleItems();
        if (items.length === 0) return;

        const currentFocus = this.focusedKey();
        const itemValues = items.map(i => i.value());
        const currentIndex = currentFocus ? itemValues.indexOf(currentFocus) : -1;

        const expandKey = this.isRtl() ? 'ArrowLeft' : 'ArrowRight';
        const collapseKey = this.isRtl() ? 'ArrowRight' : 'ArrowLeft';

        event.preventDefault();
        this.dispatchKeyAction(event.key, { items, itemValues, currentFocus, currentIndex, expandKey, collapseKey });
    }

    private dispatchKeyAction(
        key: string,
        ctx: { items: readonly TreeItemComponent[]; itemValues: string[]; currentFocus: string | null; currentIndex: number; expandKey: string; collapseKey: string },
    ): void {
        const { items, itemValues, currentFocus, currentIndex, expandKey, collapseKey } = ctx;
        switch (key) {
            case 'ArrowDown': this.handleArrowDown(itemValues, currentIndex, items.length); break;
            case 'ArrowUp': this.handleArrowUp(itemValues, currentIndex, items.length); break;
            case 'Enter':
            case ' ': if (currentFocus) this.toggleSelected(currentFocus); break;
            case 'Home': if (itemValues.length > 0) this.focusedKey.set(itemValues[0]); break;
            case 'End': {
                const last = itemValues.at(-1);
                if (last !== undefined) {
                    this.focusedKey.set(last);
                }
                break;
            }
            case '*': this.expandAllCollapsed(items); break;
            default:
                if (key === expandKey) this.handleExpand(items, itemValues, currentFocus, currentIndex);
                else if (key === collapseKey) this.handleCollapse(items, currentFocus);
                break;
        }
    }

    private handleArrowDown(itemValues: string[], currentIndex: number, totalItems: number): void {
        // currentIndex === -1 (nothing focused) also satisfies this — it moves to
        // itemValues[0], so no separate first-item branch is needed.
        if (currentIndex < totalItems - 1) {
            this.focusedKey.set(itemValues[currentIndex + 1]);
        }
    }

    private handleArrowUp(itemValues: string[], currentIndex: number, totalItems: number): void {
        if (currentIndex > 0) {
            this.focusedKey.set(itemValues[currentIndex - 1]);
        } else if (currentIndex === -1 && totalItems > 0) {
            const lastKey = itemValues.at(-1);
            if (lastKey !== undefined) this.focusedKey.set(lastKey);
        }
    }

    private handleExpand(
        items: readonly TreeItemComponent[],
        itemValues: string[],
        currentFocus: string | null,
        currentIndex: number
    ): void {
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

    private handleCollapse(items: readonly TreeItemComponent[], currentFocus: string | null): void {
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

    private expandAllCollapsed(items: readonly TreeItemComponent[]): void {
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
