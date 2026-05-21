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
                  <span class="mr-2">{{ item.icon }}</span>
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
export class SplitButtonComponent {
    private readonly el = inject(ElementRef);
    private readonly document = inject(DOCUMENT);

    label = input<string>('');
    items = input<SplitButtonItem[]>([]);
    variant = input<ButtonVariant>('default');
    size = input<ButtonSize>('default');
    disabled = input(false, { transform: booleanAttribute });
    class = input('');

    primaryClick = output<MouseEvent>();
    itemClick = output<SplitButtonItem>();

    isOpen = signal(false);

    private readonly clickListener = (event: MouseEvent) => {
        if (!this.el.nativeElement.contains(event.target)) {
            this.isOpen.set(false);
        }
    };

    constructor() {
        this.document.addEventListener('click', this.clickListener);
    }

    ngOnDestroy() {
        this.document.removeEventListener('click', this.clickListener);
    }

    containerClasses = computed(() => cn(
        'relative inline-flex',
        this.class()
    ));

    primaryClasses = computed(() => cn(
        'rounded-r-none border-r-0',
        this.class()
    ));

    dropdownClasses = computed(() => cn(
        'rounded-l-none px-2'
    ));

    private readonly menuPosition = signal<'below' | 'above'>('below');

    menuClasses = computed(() => cn(
        'absolute z-50 min-w-[8rem] max-w-[calc(100vw-2rem)]',
        this.menuPosition() === 'below'
            ? 'top-full right-0 mt-1'
            : 'bottom-full right-0 mb-1',
        'rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        'animate-in fade-in-0 zoom-in-95'
    ));

    itemClasses(item: SplitButtonItem) {
        return cn(
            'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
            'hover:bg-accent hover:text-accent-foreground',
            'focus:bg-accent focus:text-accent-foreground',
            item.disabled && 'pointer-events-none opacity-50'
        );
    }

    onPrimaryClick(event: MouseEvent) {
        this.primaryClick.emit(event);
    }

    toggleMenu(event: MouseEvent) {
        event.stopPropagation();
        const opening = !this.isOpen();
        if (opening) {
            const rect = this.el.nativeElement.getBoundingClientRect();
            const spaceBelow = globalThis.innerHeight - rect.bottom;
            this.menuPosition.set(spaceBelow < 150 ? 'above' : 'below');
        }
        this.isOpen.set(opening);
    }

    onItemClick(item: SplitButtonItem, event: MouseEvent) {
        event.stopPropagation();
        if (!item.disabled) {
            this.itemClick.emit(item);
            item.click?.(item);
            this.isOpen.set(false);
        }
    }

    onDropdownKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
            event.preventDefault();
            this.isOpen.set(true);
            setTimeout(() => {
                const firstItem = this.el.nativeElement.querySelector('[role="menuitem"]');
                firstItem?.focus();
            });
        }
    }

    onMenuKeydown(event: KeyboardEvent) {
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

