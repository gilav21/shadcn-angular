import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    inject,
    ElementRef,
    InjectionToken,
    forwardRef,
    booleanAttribute,
    OnDestroy,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cn } from '../../lib/utils';
import { ButtonVariant, ButtonSize, ButtonComponent } from '../button';

export const SPLIT_BUTTON = new InjectionToken<SplitButtonComponent>('SPLIT_BUTTON');

/**
 * SplitButton Item interface for data-driven mode
 */
export interface SplitButtonItem {
    label: string;
    value?: string;
    icon?: string;
    disabled?: boolean;
    click?: (item: SplitButtonItem) => void;
}

/**
 * SplitButton - A button with primary action and dropdown menu
 * 
 * Usage:
 * <ui-split-button label="Save" [items]="saveOptions" (primaryClick)="save()" />
 * 
 * Or with content projection:
 * <ui-split-button>
 *   <ui-split-button-primary>Save</ui-split-button-primary>
 *   <ui-split-button-menu>
 *     <ui-split-button-item>Save as Draft</ui-split-button-item>
 *     <ui-split-button-item>Save and Close</ui-split-button-item>
 *   </ui-split-button-menu>
 * </ui-split-button>
 */
@Component({
    selector: 'ui-split-button',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [{ provide: SPLIT_BUTTON, useExisting: forwardRef(() => SplitButtonComponent) }],
    imports: [ButtonComponent],
    template: `
    <div 
      [class]="containerClasses()"
      [attr.data-slot]="'split-button'"
      role="group"
    >
      @if (label()) {
        <ui-button
          [class]="primaryClasses()"
          [variant]="variant()"
          [size]="size()"
          [disabled]="disabled()"
          (click)="onPrimaryClick($event)"
          type="button"
        >
          {{ label() }}
        </ui-button>
      } @else {
        <ng-content select="ui-split-button-primary" />
      }
      
      <ui-button
        [class]="dropdownClasses()"
        [variant]="variant()"
        [size]="size()"
        [disabled]="disabled()"
        (click)="toggleMenu($event)"
        (keydown)="onDropdownKeydown($event)"
        type="button"
        aria-haspopup="menu"
        [ariaLabel]="dropdownAriaLabel()"
        [attr.aria-expanded]="isOpen()"
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
          [class]="isOpen() ? 'rotate-180 transition-transform' : 'transition-transform'"
        >
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </ui-button>
      
      @if (isOpen()) {
        <div
          [class]="menuClasses()"
          role="menu"
          tabindex="-1"
          (keydown)="onMenuKeydown($event)"
        >
          @if (items().length > 0) {
            @for (item of items(); track item.label) {
              <button
                [class]="itemClasses(item)"
                [disabled]="item.disabled"
                (click)="onItemClick(item, $event)"
                role="menuitem"
                tabindex="-1"
              >
                @if (item.icon) {
                  <span class="me-2">{{ item.icon }}</span>
                }
                {{ item.label }}
              </button>
            }
          } @else {
            <ng-content select="ui-split-button-menu" />
          }
        </div>
      }
    </div>
  `,
    host: {
        class: 'contents',
    },
})
export class SplitButtonComponent implements OnDestroy {
    private readonly el = inject(ElementRef);
    private readonly document = inject(DOCUMENT);

    /**
     * Text of the primary (left) half. Setting it selects simple mode: any
     * projected `ui-split-button-primary` is dropped from the template while
     * this is non-empty, so the two are alternatives, not additive. Leave it at
     * `''` to project your own primary content instead.
     */
    label = input<string>('');
    /**
     * Menu entries for data-driven mode. A non-empty array wins over projected
     * `ui-split-button-menu` content, which is only rendered while this is
     * empty — the two modes cannot be mixed in one menu. Each entry's own
     * `click` callback fires after {@link itemClick}; `disabled` entries are
     * greyed, non-clickable, and skipped by the arrow-key ring in
     * {@link onMenuKeydown}. Entries are tracked by `label`, so labels must be
     * unique.
     */
    items = input<SplitButtonItem[]>([]);
    /**
     * Button variant applied to both halves so they read as one control;
     * projected `ui-split-button-primary` inherits it through the injected
     * parent rather than taking its own.
     */
    variant = input<ButtonVariant>('default');
    /**
     * Button size applied to both halves (and to a projected
     * `ui-split-button-primary`). Does not affect the menu, which sizes itself
     * from its own `text-sm` rows.
     */
    size = input<ButtonSize>('default');
    /**
     * Disables both halves — primary action and dropdown toggle alike — so
     * there is no way to open the menu while set. It does not force an open
     * menu closed, and individual entries are disabled via
     * `SplitButtonItem.disabled` / the item component's own `disabled`.
     */
    disabled = input(false, { transform: booleanAttribute });
    /**
     * Extra classes. Applied to the outer `inline-flex` container *and* to the
     * primary button (see `containerClasses` / `primaryClasses`), but never to
     * the dropdown half or the menu — layout utilities meant for the group as a
     * whole may therefore land on the primary button too.
     */
    class = input('');
    /**
     * Accessible name for the icon-only dropdown half of the split button. It has
     * no text of its own, so without this it reached screen readers unnamed
     * (axe `button-name`).
     */
    readonly dropdownAriaLabel = input('More options');

    /**
     * Fires on activation of the primary half only — the dropdown toggle never
     * emits it. Emitted by both simple mode ({@link label}) and a projected
     * `ui-split-button-primary`, which forwards its click through the parent.
     */
    primaryClick = output<MouseEvent>();
    /**
     * Fires when a menu entry is activated, just before the menu closes;
     * disabled entries emit nothing. In data-driven mode the emitted value is
     * the {@link items} entry itself and its own `click` callback runs
     * afterwards. A projected `ui-split-button-item` instead synthesises
     * `{ label: '', value }` from its `value` input, so identify projected
     * entries by `value`, not `label`.
     */
    itemClick = output<SplitButtonItem>();

    isOpen = signal(false);

    private readonly clickListener = (event: MouseEvent): void => {
        if (!this.el.nativeElement.contains(event.target)) {
            this.isOpen.set(false);
        }
    };

    constructor() {
        this.document.addEventListener('click', this.clickListener);
    }

    ngOnDestroy(): void {
        this.document.removeEventListener('click', this.clickListener);
    }

    containerClasses = computed(() => cn(
        'relative inline-flex',
        this.class()
    ));

    primaryClasses = computed(() => cn(
        'rounded-e-none border-e-0',
        this.class()
    ));

    // The divider is the dropdown's start border. Deriving it from `current`
    // (the variant's own foreground) keeps it visible on every variant in both
    // themes — the button base sets `border-transparent`, so a solid-fill
    // variant like `default` otherwise renders no divider at all.
    dropdownClasses = computed(() => cn(
        'rounded-s-none px-2 border-s-current/25'
    ));

    private readonly menuPosition = signal<'below' | 'above'>('below');

    menuClasses = computed(() => cn(
        'absolute z-50 min-w-[8rem] max-w-[calc(100vw-2rem)]',
        this.menuPosition() === 'below'
            ? 'top-full end-0 mt-1'
            : 'bottom-full end-0 mb-1',
        'rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        'animate-in fade-in-0 zoom-in-95'
    ));

    /**
     * Row classes for one data-driven entry. A `disabled` entry additionally
     * gets `opacity-50` and `pointer-events-none`, so it cannot be hovered or
     * clicked; keyboard skipping is handled separately by
     * {@link onMenuKeydown}.
     */
    itemClasses(item: SplitButtonItem): string {
        return cn(
            'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
            'hover:bg-accent hover:text-accent-foreground',
            'focus:bg-accent focus:text-accent-foreground',
            item.disabled && 'pointer-events-none opacity-50'
        );
    }

    /**
     * Click handler of the simple-mode primary button: re-emits the event as
     * {@link primaryClick}. It neither opens nor closes the menu, and it does
     * not stop propagation — an open menu is therefore dismissed by the
     * document-level outside-click listener only when the click lands outside
     * this component, which the primary button does not.
     */
    onPrimaryClick(event: MouseEvent): void {
        this.primaryClick.emit(event);
    }

    /**
     * Click handler of the dropdown half: toggles the menu open/closed. On the
     * way open it measures the host's viewport rect and flips the menu above
     * the button when fewer than 150px remain below, so the popup direction is
     * decided once per open, not tracked while scrolling. Stops propagation so
     * the document listener that closes on outside clicks does not immediately
     * undo the open.
     */
    toggleMenu(event: MouseEvent): void {
        event.stopPropagation();
        const opening = !this.isOpen();
        if (opening) {
            const rect = this.el.nativeElement.getBoundingClientRect();
            const spaceBelow = globalThis.innerHeight - rect.bottom;
            this.menuPosition.set(spaceBelow < 150 ? 'above' : 'below');
        }
        this.isOpen.set(opening);
    }

    /**
     * Activates a data-driven entry: emits {@link itemClick}, then invokes the
     * entry's own `click` callback, then closes the menu — all three are
     * skipped for a `disabled` entry. Propagation is stopped so the closing is
     * driven from here rather than by the outside-click listener.
     */
    onItemClick(item: SplitButtonItem, event: MouseEvent): void {
        event.stopPropagation();
        if (!item.disabled) {
            this.itemClick.emit(item);
            item.click?.(item);
            this.isOpen.set(false);
        }
    }

    /**
     * Keyboard handler on the dropdown toggle. Enter, Space and ArrowDown all
     * *open* the menu (they never close it — the toggle only closes by mouse
     * via {@link toggleMenu}) and move focus to the first `role="menuitem"` in
     * DOM order on the next macrotask, once the menu has rendered. The query is
     * not filtered by `disabled`, so when the first entry is disabled the
     * `focus()` call is a no-op and focus stays on the toggle — the disabled
     * skipping in {@link onMenuKeydown} only covers later arrow steps. Other keys
     * are left to the browser, so Tab still moves on normally.
     */
    onDropdownKeydown(event: KeyboardEvent): void {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
            event.preventDefault();
            this.isOpen.set(true);
            setTimeout(() => {
                const firstItem = this.el.nativeElement.querySelector('[role="menuitem"]');
                firstItem?.focus();
            });
        }
    }

    /**
     * Keyboard handler on the open menu. ArrowDown/ArrowUp walk the enabled
     * entries only (`[role="menuitem"]:not([disabled])`, so disabled entries are
     * both greyed and unreachable) and wrap around at either end; from an
     * unfocused menu ArrowDown lands on the first entry and ArrowUp on the last.
     * Escape and Tab close the menu — Tab without `preventDefault`, so focus
     * moves on to the next tab stop. Neither restores focus to the dropdown
     * toggle, so after Escape the focused entry is destroyed and focus falls
     * back to `document.body`. Enter/Space are left to the native button, which
     * activates the entry.
     */
    onMenuKeydown(event: KeyboardEvent): void {
        const items: HTMLElement[] = Array.from(
            this.el.nativeElement.querySelectorAll('[role="menuitem"]:not([disabled])')
        );
        const currentIndex = items.indexOf(document.activeElement as HTMLElement);

        switch (event.key) {
            case 'ArrowDown':
                { event.preventDefault();
                const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
                items[nextIndex]?.focus();
                break; }
            case 'ArrowUp':
                { event.preventDefault();
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
                items[prevIndex]?.focus();
                break; }
            case 'Escape':
                event.preventDefault();
                this.isOpen.set(false);
                break;
            case 'Tab':
                this.isOpen.set(false);
                break;
        }
    }
}

