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

    id = input<string>(this._autoId);
    class = input('');
    value = input.required<string>();

    headerElement = viewChild<ElementRef<HTMLElement>>('header');

    readonly elementRef = inject(ElementRef);
    readonly parentItem = inject(TreeItemComponent, { optional: true, skipSelf: true });

    readonly tree = inject(TREE, { optional: true });
    children = contentChildren(forwardRef(() => TreeItemComponent));

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

    onExpandClick(event: MouseEvent) {
        event.stopPropagation();
        this.tree?.toggleExpanded(this.value());
    }

    onHeaderClick(event: MouseEvent) {
        this.tree?.focusedKey.set(this.value());
        this.tree?.toggleSelected(this.value());
    }
}
