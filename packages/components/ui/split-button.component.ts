import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    inject,
    ElementRef,
    booleanAttribute,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cn } from '../lib/utils';
import { ButtonVariant, ButtonSize, buttonVariants, ButtonComponent } from './button.component';

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
    private el = inject(ElementRef);
    private document = inject(DOCUMENT);

    label = input<string>('');
    items = input<SplitButtonItem[]>([]);
    variant = input<ButtonVariant>('default');
    size = input<ButtonSize>('default');
    disabled = input(false, { transform: booleanAttribute });
    class = input('');

    primaryClick = output<MouseEvent>();
    itemClick = output<SplitButtonItem>();

    isOpen = signal(false);

    private clickListener = (event: MouseEvent) => {
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

    menuClasses = computed(() => cn(
        'absolute top-full right-0 mt-1 min-w-[8rem] z-50',
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
        this.isOpen.update(v => !v);
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
        const items = Array.from(
            this.el.nativeElement.querySelectorAll('[role="menuitem"]:not([disabled])')
        ) as HTMLElement[];
        const currentIndex = items.indexOf(document.activeElement as HTMLElement);

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
                items[nextIndex]?.focus();
                break;
            case 'ArrowUp':
                event.preventDefault();
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
                items[prevIndex]?.focus();
                break;
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

/**
 * SplitButtonPrimary - Primary action button (for content projection mode)
 */
@Component({
    selector: 'ui-split-button-primary',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonComponent],
    template: `
    <ui-button
      [class]="classes()"
      [variant]="splitButton.variant()"
      [size]="splitButton.size()"
      [disabled]="splitButton.disabled()"
      (click)="onClick($event)"
      type="button"
    >
      <ng-content />
    </ui-button>
  `,
    host: { class: 'contents' },
})
export class SplitButtonPrimaryComponent {
    splitButton = inject(SplitButtonComponent);

    classes = computed(() => cn(
        'rounded-r-none border-r-0'
    ));

    onClick(event: MouseEvent) {
        this.splitButton.primaryClick.emit(event);
    }
}

/**
 * SplitButtonMenu - Menu container (for content projection mode)
 */
@Component({
    selector: 'ui-split-button-menu',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: { class: 'contents' },
})
export class SplitButtonMenuComponent { }

/**
 * SplitButtonItem - Menu item (for content projection mode)
 */
@Component({
    selector: 'ui-split-button-item',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <button
      [class]="classes()"
      [disabled]="disabled()"
      (click)="onClick($event)"
      role="menuitem"
      tabindex="-1"
    >
      <ng-content />
    </button>
  `,
    host: { class: 'contents' },
})
export class SplitButtonItemComponent {
    private splitButton = inject(SplitButtonComponent);

    disabled = input(false, { transform: booleanAttribute });
    value = input<string>('');

    classes = computed(() => cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
        'hover:bg-accent hover:text-accent-foreground',
        'focus:bg-accent focus:text-accent-foreground',
        this.disabled() && 'pointer-events-none opacity-50'
    ));

    onClick(event: MouseEvent) {
        if (!this.disabled()) {
            this.splitButton.itemClick.emit({
                label: '',
                value: this.value()
            });
            this.splitButton.isOpen.set(false);
        }
    }
}
