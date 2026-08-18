import {
    Component,
    ChangeDetectionStrategy,
    input,
    signal,
    inject,
    ElementRef,
    OnDestroy,
    forwardRef,
    InjectionToken,
} from '@angular/core';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { isRtl } from '../../lib/utils';
import { ContextMenuContentComponent } from './sub/context-menu-content.component';
import { ContextMenuItemComponent } from './sub/context-menu-item.component';
import { ContextMenuLabelComponent } from './sub/context-menu-label.component';
import { ContextMenuSeparatorComponent } from './sub/context-menu-separator.component';
import { ContextMenuSubComponent } from './sub/context-menu-sub.component';
import { ContextMenuSubTriggerComponent } from './sub/context-menu-sub-trigger.component';
import { ContextMenuSubContentComponent } from './sub/context-menu-sub-content.component';

export interface ContextMenuItem {
    label?: string;
    value?: string;
    icon?: string;
    shortcut?: string;
    disabled?: boolean;
    type?: 'item' | 'separator' | 'label' | 'sub';
    children?: ContextMenuItem[];
    inset?: boolean;
    click?: (item: ContextMenuItem) => void;
}

export const CONTEXT_MENU = new InjectionToken<ContextMenuComponent>('CONTEXT_MENU');

@Component({
    selector: 'ui-context-menu',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgTemplateOutlet,
        forwardRef(() => ContextMenuContentComponent),
        forwardRef(() => ContextMenuItemComponent),
        forwardRef(() => ContextMenuLabelComponent),
        forwardRef(() => ContextMenuSeparatorComponent),
        forwardRef(() => ContextMenuSubComponent),
        forwardRef(() => ContextMenuSubTriggerComponent),
        forwardRef(() => ContextMenuSubContentComponent),
    ],
    template: `
      <ng-content />
      @if (items().length > 0) {
        <ui-context-menu-content>
          <ng-container *ngTemplateOutlet="menuItemsTpl; context: { $implicit: items() }"></ng-container>
        </ui-context-menu-content>
      }

      <ng-template #menuItemsTpl let-items>
        @for (item of items; track $index) {
          @if (item.type === 'separator') {
              <ui-context-menu-separator />
          } @else if (item.type === 'label') {
              <ui-context-menu-label [inset]="item.inset">{{ item.label }}</ui-context-menu-label>
          } @else if (item.type === 'sub') {
               <ui-context-menu-sub>
                  <ui-context-menu-sub-trigger [inset]="item.inset" [disabled]="item.disabled">
                      {{ item.label }}
                  </ui-context-menu-sub-trigger>
                  <ui-context-menu-sub-content>
                      <ng-container *ngTemplateOutlet="menuItemsTpl; context: { $implicit: item.children }"></ng-container>
                  </ui-context-menu-sub-content>
               </ui-context-menu-sub>
          } @else {
               <ui-context-menu-item
                  [disabled]="item.disabled"
                  [inset]="item.inset"
                  [shortcut]="item.shortcut"
                  (click)="item.click ? item.click(item) : null">
                  {{ item.label }}
               </ui-context-menu-item>
          }
        }
      </ng-template>
    `,
    host: {
        class: 'contents',
        '[attr.data-slot]': '"context-menu"',
    },
    providers: [{ provide: CONTEXT_MENU, useExisting: forwardRef(() => ContextMenuComponent) }],
})
export class ContextMenuComponent implements OnDestroy {
    private readonly document = inject(DOCUMENT);
    private readonly el = inject(ElementRef);

    /**
     * Data-driven menu contents. When non-empty the component renders its own
     * `<ui-context-menu-content>` from this array (separators, labels, nested
     * `sub` branches and items, recursively), so you only project a trigger.
     * Leave it empty (the default) to hand-author the content with
     * `<ui-context-menu-content>` and friends — both forms may not be combined,
     * as a non-empty array appends a second content block after your projected
     * one. Each entry's `click` callback fires before the menu closes; see
     * {@link ContextMenuItem}.
     */
    items = input<ContextMenuItem[]>([]);
    open = signal(false);
    position = signal({ x: 0, y: 0 });
    data = signal<unknown>(undefined);

    private readonly clickListener = (event: MouseEvent): void => {
        const target = event.target as HTMLElement;
        if (target.closest('[data-context-menu-portal]') || target.closest('[data-context-menu-sub-portal]')) {
            return;
        }
        this.close();
    };

    private readonly escListener = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') {
            this.close();
        }
    };

    private readonly scrollListener = (): void => {
        this.close();
    };

    constructor() {
        this.document.addEventListener('click', this.clickListener, true);
        this.document.addEventListener('keydown', this.escListener);
        this.document.addEventListener('scroll', this.scrollListener, true);
    }

    ngOnDestroy(): void {
        this.document.removeEventListener('click', this.clickListener, true);
        this.document.removeEventListener('keydown', this.escListener);
        this.document.removeEventListener('scroll', this.scrollListener, true);
    }

    /**
     * Opens the menu with its top-left corner at viewport coordinates
     * (`x`, `y`) — pass `clientX`/`clientY`, not page coordinates, since the
     * content is `position: fixed`. The content clamps itself 8px inside the
     * viewport on the next-but-one animation frame if it would overflow.
     * Calling this while already open just repositions it. `data` is stashed
     * on the `data` signal for the duration, so a shared menu can read which
     * row was right-clicked. Closed again by {@link close}, an outside click,
     * Escape, a scroll anywhere on the page, or selecting an item.
     */
    show(x: number, y: number, data?: unknown): void {
        this.position.set({ x, y });
        this.data.set(data);
        this.open.set(true);
    }

    /**
     * Closes the menu, tearing down its body portal. Safe to call when already
     * closed. The `data` passed to {@link show} is deliberately kept, so a
     * handler running after the close can still read it.
     */
    close(): void {
        this.open.set(false);
    }

    /**
     * True when this menu sits in a right-to-left subtree, resolved live from
     * the host element's computed direction (not cached). Sub-menus consult it
     * to flip their flyout side and to swap the ArrowLeft/ArrowRight roles.
     */
    isRtl(): boolean {
        return isRtl(this.el.nativeElement);
    }
}
