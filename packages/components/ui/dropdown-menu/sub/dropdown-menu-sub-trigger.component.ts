import {
    booleanAttribute,
    ChangeDetectionStrategy,
    Component,
    computed,
    ElementRef,
    inject,
    input,
    ViewChild,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { isTouchDevice } from '../../../lib/touch';
import { DropdownMenuService } from '../dropdown-menu.component';
import { DropdownMenuSubComponent } from './dropdown-menu-sub.component';

@Component({
    selector: 'ui-dropdown-menu-sub-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div
      #trigger
      [class]="classes()"
      role="menuitem"
      tabindex="0"
      [attr.aria-haspopup]="true"
      [attr.aria-expanded]="sub.isOpen()"
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()"
      (keydown)="onKeydown($event)"
      (click)="onClick()"
    >
      <ng-content />
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" class="h-4 w-4 ltr:ml-auto rtl:mr-auto rtl:rotate-180" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    </div>
  `,
    host: { class: 'contents' }
})
export class DropdownMenuSubTriggerComponent {
    class = input('');
    disabled = input(false, { transform: booleanAttribute });
    inset = input(false, { transform: booleanAttribute });

    readonly sub = inject(DropdownMenuSubComponent);
    readonly service = inject(DropdownMenuService);
    readonly el = inject(ElementRef);

    @ViewChild('trigger') triggerEl!: ElementRef<HTMLElement>;

    constructor() {
        this.sub.registerTrigger(this);
    }

    classes = computed(() => cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        this.sub.isOpen() && 'bg-accent text-accent-foreground',
        this.inset() && 'ltr:pl-8 rtl:pr-8',
        this.class()
    ));

    onMouseEnter() {
        if (isTouchDevice()) return;
        this.sub.enter();
    }

    onMouseLeave() {
        if (isTouchDevice()) return;
        this.sub.leave();
    }

    onClick() {
        if (!isTouchDevice()) return;
        if (this.sub.isOpen()) {
            this.sub.leave();
        } else {
            this.sub.enter();
        }
    }

    focus() {
        this.triggerEl?.nativeElement.focus();
    }

    onKeydown(event: KeyboardEvent) {
        if (event.key === 'ArrowRight') {
            if (this.service.isRtl()) return;
            event.preventDefault();
            event.stopPropagation();
            this.sub.enter();
            this.sub.focusContent();
        }
        if (event.key === 'ArrowLeft') {
            if (this.service.isRtl()) {
                event.preventDefault();
                event.stopPropagation();
                this.sub.enter();
                this.sub.focusContent();
            }
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            this.sub.enter();
            this.sub.focusContent();
        }
    }
}
