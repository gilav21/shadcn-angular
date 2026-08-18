import {
    Component,
    ChangeDetectionStrategy,
    input,
    model,
    inject,
    ElementRef,
    OnDestroy,
    Injectable,
    InjectionToken,
    forwardRef,
} from '@angular/core';
import { NgTemplateOutlet, DOCUMENT } from '@angular/common';
import { isRtl } from '../../lib/utils';
import { DropdownMenuContentComponent } from './sub/dropdown-menu-content.component';
import { DropdownMenuItemComponent } from './sub/dropdown-menu-item.component';
import { DropdownMenuLabelComponent } from './sub/dropdown-menu-label.component';
import { DropdownMenuSeparatorComponent } from './sub/dropdown-menu-separator.component';
import { DropdownMenuSubComponent } from './sub/dropdown-menu-sub.component';
import { DropdownMenuSubTriggerComponent } from './sub/dropdown-menu-sub-trigger.component';
import { DropdownMenuSubContentComponent } from './sub/dropdown-menu-sub-content.component';

export interface DropdownItem {
    label?: string;
    value?: string;
    icon?: string;
    shortcut?: string;
    disabled?: boolean;
    type?: 'item' | 'separator' | 'label' | 'sub';
    children?: DropdownItem[];
    inset?: boolean;
    click?: (item: DropdownItem) => void;
}

@Injectable()
export class DropdownMenuService {
    private triggerRef: HTMLElement | null = null;
    private rootEl: HTMLElement | null = null;

    /**
     * Called by `<ui-dropdown-menu>` on construction; the element it passes is
     * the direction probe for {@link isRtl}.
     */
    registerRoot(el: HTMLElement): void {
        this.rootEl = el;
    }

    /**
     * Called by `<ui-dropdown-menu-trigger>` once rendered, so focus can be
     * restored to it later. Only one trigger per menu — a second registration
     * replaces the first.
     */
    registerTrigger(el: HTMLElement): void {
        this.triggerRef = el;
    }

    /**
     * Returns focus to the registered trigger — used when the menu closes via
     * Escape so keyboard users are not dropped at the top of the document.
     * A no-op until the trigger has registered.
     */
    focusTrigger(): void {
        this.triggerRef?.focus();
    }

    /**
     * Whether the menu's root renders right-to-left, read from computed style
     * so an inherited `dir` counts. Drives the ArrowLeft/ArrowRight swap for
     * submenus. `false` until {@link registerRoot} has run.
     */
    isRtl(): boolean {
        if (!this.rootEl) return false;
        return isRtl(this.rootEl);
    }
}

export const DROPDOWN_MENU = new InjectionToken<DropdownMenuComponent>('DROPDOWN_MENU');

@Component({
    selector: 'ui-dropdown-menu',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        DropdownMenuService,
        { provide: DROPDOWN_MENU, useExisting: forwardRef(() => DropdownMenuComponent) },
    ],
    imports: [
        NgTemplateOutlet,
        forwardRef(() => DropdownMenuContentComponent),
        forwardRef(() => DropdownMenuItemComponent),
        forwardRef(() => DropdownMenuLabelComponent),
        forwardRef(() => DropdownMenuSeparatorComponent),
        forwardRef(() => DropdownMenuSubComponent),
        forwardRef(() => DropdownMenuSubTriggerComponent),
        forwardRef(() => DropdownMenuSubContentComponent),
    ],
    template: `
      <ng-content />
      @if (items().length > 0) {
        <ui-dropdown-menu-content>
          <ng-container *ngTemplateOutlet="menuItemsTpl; context: { $implicit: items() }"></ng-container>
        </ui-dropdown-menu-content>
      }

      <ng-template #menuItemsTpl let-items>
        @for (item of items; track $index) {
          @if (item.type === 'separator') {
              <ui-dropdown-menu-separator />
          } @else if (item.type === 'label') {
              <ui-dropdown-menu-label>{{ item.label }}</ui-dropdown-menu-label>
          } @else if (item.type === 'sub') {
               <ui-dropdown-menu-sub>
                  <ui-dropdown-menu-sub-trigger [inset]="item.inset" [disabled]="item.disabled">
                      {{ item.label }}
                  </ui-dropdown-menu-sub-trigger>
                  <ui-dropdown-menu-sub-content>
                      <ng-container *ngTemplateOutlet="menuItemsTpl; context: { $implicit: item.children }"></ng-container>
                  </ui-dropdown-menu-sub-content>
               </ui-dropdown-menu-sub>
          } @else {
               <ui-dropdown-menu-item
                  [disabled]="item.disabled"
                  [inset]="item.inset"
                  [shortcut]="item.shortcut"
                  (click)="item.click ? item.click(item) : null">
                  {{ item.label }}
               </ui-dropdown-menu-item>
          }
        }
      </ng-template>
    `,
    host: {
        class: 'relative inline-block',
    },
})
export class DropdownMenuComponent implements OnDestroy {
    private readonly el = inject(ElementRef);
    private readonly document = inject(DOCUMENT);
    private readonly service = inject(DropdownMenuService);

    /**
     * Data-driven menu body. A non-empty array renders a whole
     * `<ui-dropdown-menu-content>` from the descriptors — including nested
     * `type: 'sub'` children — *in addition to* any projected content, so
     * supply one or the other, not both. Still needs a projected
     * `<ui-dropdown-menu-trigger>`.
     */
    items = input<DropdownItem[]>([]);
    /**
     * Open state, two-way bindable as `[(open)]`. Also written by the
     * document-level outside-click listener and by Escape in the content, so a
     * consumer binding sees closes it did not request.
     */
    open = model(false);

    constructor() {
        this.document.addEventListener('click', this.clickListener);
        this.service.registerRoot(this.el.nativeElement);
    }

    private readonly clickListener = (event: MouseEvent): void => {
        if (!this.el.nativeElement.contains(event.target)) {
            this.hide();
        }
    };

    ngOnDestroy(): void {
        this.document.removeEventListener('click', this.clickListener);
    }

    /** Flips {@link open}. Ignores any disabled state — the trigger guards that. */
    toggle(): void {
        this.open.update(v => !v);
    }

    /**
     * Opens the menu; the content then moves focus to its first enabled item on
     * the next tick.
     */
    show(): void {
        this.open.set(true);
    }

    /**
     * Closes the menu without restoring focus — call
     * {@link DropdownMenuService.focusTrigger} too when closing in response to a
     * keyboard action.
     */
    hide(): void {
        this.open.set(false);
    }
}
