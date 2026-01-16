import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    inject,
    InjectionToken,
    forwardRef,
    contentChildren,
    output,
    ElementRef,
    viewChild,
    Directive,
    HostListener,
} from '@angular/core';
import { Directionality } from '@angular/cdk/bidi';
import { cn } from '../lib/utils';

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
    template: `
    <div
      #treeRoot
      [class]="classes()"
      [attr.data-slot]="'tree'"
      role="tree"
      [attr.aria-multiselectable]="selectable() === 'multiple'"
      tabindex="0"
      [attr.aria-activedescendant]="activeDescendantId()"
      (keydown)="onKeydown($event)"
    >
      <ng-content />
    </div>
  `,
    host: { class: 'block' },
})
export class TreeComponent {
    class = input('');
    selectable = input<'single' | 'multiple' | 'none'>('none');

    expandedKeys = signal<Set<string>>(new Set());
    selectedKeys = signal<Set<string>>(new Set());
    focusedKey = signal<string | null>(null);

    selectionChange = output<string[]>();
    expandChange = output<string[]>();

    treeRoot = viewChild<ElementRef<HTMLElement>>('treeRoot');
    items = contentChildren(forwardRef(() => TreeItemComponent), { descendants: true });

    private dir = inject(Directionality, { optional: true });

    activeDescendantId = computed(() => {
        const focused = this.focusedKey();
        if (!focused) return null;
        return this.items().find(item => item.value() === focused)?.id() ?? null;
    });

    isRtl = computed(() => this.dir?.value === 'rtl');

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

    private getVisibleItems(): TreeItemComponent[] {
        return this.items().filter(item => {
            const header = item.headerElement()?.nativeElement;
            if (!header) return false;
            const rect = header.getBoundingClientRect();
            return rect.width > 0 || rect.height > 0;
        });
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
                if (currentIndex < items.length - 1) {
                    this.focusedKey.set(itemValues[currentIndex + 1]);
                } else if (currentIndex === -1 && items.length > 0) {
                    this.focusedKey.set(itemValues[0]);
                }
                break;

            case 'ArrowUp':
                event.preventDefault();
                if (currentIndex > 0) {
                    this.focusedKey.set(itemValues[currentIndex - 1]);
                } else if (currentIndex === -1 && items.length > 0) {
                    this.focusedKey.set(itemValues[items.length - 1]);
                }
                break;

            case expandKey:
                event.preventDefault();
                if (currentFocus) {
                    const item = items.find(i => i.value() === currentFocus);
                    if (item?.hasChildren()) {
                        if (!this.isExpanded(currentFocus)) {
                            this.toggleExpanded(currentFocus);
                        } else {
                            const childIndex = currentIndex + 1;
                            if (childIndex < items.length) {
                                this.focusedKey.set(itemValues[childIndex]);
                            }
                        }
                    }
                }
                break;

            case collapseKey:
                event.preventDefault();
                if (currentFocus) {
                    if (this.isExpanded(currentFocus)) {
                        this.toggleExpanded(currentFocus);
                    } else {
                        const currentItem = items.find(i => i.value() === currentFocus);
                        const parent = currentItem?.parentItem;
                        if (parent) {
                            this.focusedKey.set(parent.value());
                        }
                    }
                }
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
                    this.focusedKey.set(itemValues[items.length - 1]);
                }
                break;

            case '*':
                event.preventDefault();
                items.forEach(item => {
                    if (item.hasChildren() && !this.isExpanded(item.value())) {
                        this.toggleExpanded(item.value());
                    }
                });
                break;
        }
    }
}

let nextId = 0;

@Component({
    selector: 'ui-tree-item',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div
      [id]="id()"
      [class]="classes()"
      [attr.data-slot]="'tree-item'"
      [attr.data-expanded]="isExpanded()"
      [attr.data-selected]="isSelected()"
      [attr.data-focused]="isFocused()"
      role="treeitem"
      [attr.aria-expanded]="hasChildren() ? isExpanded() : null"
      [attr.aria-selected]="tree?.selectable() !== 'none' ? isSelected() : null"
    >
      <div #header [class]="headerClasses()" (click)="onHeaderClick($event)">
        @if (hasChildren()) {
          <button
            type="button"
            [class]="expandButtonClasses()"
            (click)="onExpandClick($event)"
            aria-hidden="true"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </button>
        } @else {
          <span class="h-4 w-4 shrink-0"></span>
        }
        <ng-content select="ui-tree-label" />
      </div>
      @if (hasChildren() && isExpanded()) {
        <div class="ps-4" role="group">
          <ng-content />
        </div>
      }
    </div>
  `,
    host: { class: 'contents' },
})
export class TreeItemComponent {
    private readonly _autoId = `ui-tree-item-${++nextId}`;

    id = input<string>(this._autoId);
    class = input('');
    value = input.required<string>();

    headerElement = viewChild<ElementRef<HTMLElement>>('header');

    elementRef = inject(ElementRef);
    parentItem = inject(TreeItemComponent, { optional: true, skipSelf: true });

    tree = inject(TREE, { optional: true });
    children = contentChildren(forwardRef(() => TreeItemComponent));

    hasChildren = computed(() => this.children().length > 0);

    isExpanded(): boolean {
        return this.tree?.isExpanded(this.value()) ?? false;
    }

    isSelected(): boolean {
        return this.tree?.isSelected(this.value()) ?? false;
    }

    isFocused(): boolean {
        return this.tree?.isFocused(this.value()) ?? false;
    }

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

@Component({
    selector: 'ui-tree-label',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span [class]="classes()" [attr.data-slot]="'tree-label'">
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class TreeLabelComponent {
    class = input('');

    classes = computed(() =>
        cn(
            'flex-1 truncate',
            this.class()
        )
    );
}

@Component({
    selector: 'ui-tree-icon',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span [class]="classes()" [attr.data-slot]="'tree-icon'" aria-hidden="true">
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class TreeIconComponent {
    class = input('');

    classes = computed(() =>
        cn(
            'me-2 h-4 w-4 shrink-0',
            this.class()
        )
    );
}
