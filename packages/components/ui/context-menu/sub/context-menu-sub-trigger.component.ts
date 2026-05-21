import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
    ElementRef,
    ViewChild,
    booleanAttribute,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { CONTEXT_MENU } from '../context-menu.component';
import { CONTEXT_MENU_SUB, type ContextMenuSubComponent } from './context-menu-sub.component';

@Component({
    selector: 'ui-context-menu-sub-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div
      #trigger
      [class]="classes()"
      role="menuitem"
      tabindex="0"
      [attr.aria-haspopup]="true"
      [attr.aria-expanded]="sub.isOpen()"
      [attr.data-slot]="'context-menu-sub-trigger'"
      (mouseenter)="sub.enter()"
      (mouseleave)="sub.leave()"
      (keydown)="onKeydown($event)"
      (click)="$event.stopPropagation()"
    >
      <ng-content />
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" class="h-4 w-4 ltr:ml-auto rtl:mr-auto rtl:rotate-180" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    </div>
  `,
    host: { class: 'contents' },
})
export class ContextMenuSubTriggerComponent {
    class = input('');
    disabled = input(false, { transform: booleanAttribute });
    inset = input(false, { transform: booleanAttribute });

    readonly sub = inject(CONTEXT_MENU_SUB) as ContextMenuSubComponent;
    private readonly contextMenu = inject(CONTEXT_MENU, { optional: true });
    readonly el = inject(ElementRef);

    @ViewChild('trigger') triggerEl!: ElementRef<HTMLElement>;

    constructor() {
        this.sub.registerTrigger(this);
    }

    classes = computed(() => cn(
        'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        this.sub.isOpen() && 'bg-accent text-accent-foreground',
        this.inset() && 'ltr:pl-8 rtl:pr-8',
        this.class()
    ));

    focus() {
        this.triggerEl?.nativeElement.focus();
    }

    onKeydown(event: KeyboardEvent) {
        const rtl = this.contextMenu?.isRtl() ?? false;
        if (event.key === 'ArrowRight') {
            if (rtl) return;
            event.preventDefault();
            event.stopPropagation();
            this.sub.enter();
            this.sub.focusContent();
        }
        if (event.key === 'ArrowLeft') {
            if (rtl) {
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
