import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
    forwardRef,
    contentChildren,
    ElementRef,
    viewChild,
    effect,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { TREE } from '../tree.component';

let nextId = 0;

@Component({
    selector: 'ui-tree-item',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './tree-item.component.html',
    host: { class: 'contents' },
})
export class TreeItemComponent {
    private readonly _autoId = `ui-tree-item-${++nextId}`;

    /** DOM id of the `role="treeitem"` element, defaulting to a generated unique id. The tree points `aria-activedescendant` at this id, so override it only with a value unique in the document. */
    id = input<string>(this._autoId);
    /** Extra classes merged onto the item wrapper, after the base `select-none`. Styling the row itself (hover, selected, focused) is driven by the item's `data-expanded` / `data-selected` / `data-focused` attributes. */
    class = input('');
    /**
     * The node's key — required, and the identity used for expansion, selection, focus and every
     * emitted key array. Must be unique across the tree; a duplicate makes both items expand and
     * select together.
     */
    value = input.required<string>();

    headerElement = viewChild<ElementRef<HTMLElement>>('header');

    readonly elementRef = inject(ElementRef);
    readonly parentItem = inject(TreeItemComponent, { optional: true, skipSelf: true });

    readonly tree = inject(TREE, { optional: true });
    children = contentChildren(forwardRef(() => TreeItemComponent));

    /**
     * Overrides child detection. Left `undefined` (the default) the item counts its projected
     * `<ui-tree-item>` children, which reports `false` for a collapsed node whose children are
     * not rendered yet — set this to `true` for lazily loaded branches so the expand chevron and
     * `aria-expanded` still appear. Set `false` to force a leaf.
     */
    hasNested = input<boolean | undefined>(undefined);

    hasChildren = computed(() => this.hasNested() ?? this.children().length > 0);

    constructor() {
        effect((onCleanup) => {
            if (this.tree) {
                this.tree.registerItem(this);
                onCleanup(() => {
                    this.tree?.unregisterItem(this);
                });
            }
        });
    }

    isExpanded = computed(() => this.tree?.isExpanded(this.value()) ?? false);

    isSelected = computed(() => this.tree?.isSelected(this.value()) ?? false);

    isFocused = computed(() => this.tree?.isFocused(this.value()) ?? false);

    isRtl = computed(() => this.tree?.isRtl() ?? false);

    classes = computed(() =>
        cn(
            'select-none',
            this.class()
        )
    );

    headerClasses = computed(() =>
        cn(
            'flex items-center gap-1 rounded-md px-2 py-1 cursor-pointer transition-colors outline-none relative',
            'hover:bg-accent/50 hover:text-foreground',
            this.isSelected() && 'bg-accent font-medium text-accent-foreground',
            this.isFocused() && 'after:absolute after:bottom-[1px] after:left-2 after:right-2 after:h-[1px] after:bg-border after:shadow-sm'
        )
    );

    expandButtonClasses = computed(() =>
        cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            this.isExpanded() && 'rotate-90',
            this.isRtl() && !this.isExpanded() && 'rotate-180'
        )
    );

    /**
     * Chevron-button handler. Stops propagation so expanding a parent does not also run
     * {@link onHeaderClick} and select it, then delegates to the tree's `toggleExpanded`.
     * The button is `aria-hidden` / `tabindex="-1"` — keyboard users expand via the arrow keys
     * on the tree root instead.
     */
    onExpandClick(event: MouseEvent): void {
        event.stopPropagation();
        this.tree?.toggleExpanded(this.value());
    }

    /**
     * Header row handler, bound to click as well as Enter/Space on the row. Moves the tree's
     * focused key to this item and toggles its selection — a no-op for selection when the tree's
     * `selectable` is `'none'`, in which case it only moves focus. Clicking a parent's label does
     * not expand it; that is the chevron's job ({@link onExpandClick}).
     */
    onHeaderClick(_event: Event): void {
        this.tree?.focusedKey.set(this.value());
        this.tree?.toggleSelected(this.value());
    }
}
