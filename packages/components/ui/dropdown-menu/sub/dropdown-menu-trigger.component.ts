import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    afterNextRender,
    inject,
    signal,
    ViewChild,
} from '@angular/core';
import { DROPDOWN_MENU, DropdownMenuService } from '../dropdown-menu.component';
import { hasInteractiveContent } from '../../../lib/a11y';

@Component({
    selector: 'ui-dropdown-menu-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span
      #trigger
      [attr.role]="wrapsInteractive() ? null : 'button'"
      [attr.tabindex]="wrapsInteractive() ? null : 0"
      (click)="onClick($event)"
      (keydown)="onKeydown($event)"
      [attr.data-slot]="'dropdown-trigger'"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class DropdownMenuTriggerComponent {
    private readonly menu = inject(DROPDOWN_MENU, { optional: true });
    private readonly service = inject(DropdownMenuService);
    private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

    @ViewChild('trigger') triggerEl!: ElementRef<HTMLElement>;

    /** See `lib/a11y.ts` — stays transparent when the projected content is already a control. */
    readonly wrapsInteractive = signal(false);

    constructor() {
        afterNextRender(() => {
            this.wrapsInteractive.set(hasInteractiveContent(this.el.nativeElement));
        });
        setTimeout(() => {
            const triggerButton = this.el.nativeElement.querySelector<HTMLElement>('[data-slot="dropdown-trigger"]');
            if (triggerButton) {
                this.service.registerTrigger(triggerButton);
            }
        });
    }

    onClick(event: MouseEvent): void {
        event.stopPropagation();
        this.menu?.toggle();
    }

    /**
     * Enter/Space are only handled for the wrapper's own activation — projected
     * focusable content already turns them into a bubbling click. ArrowDown
     * opens the menu from either.
     */
    onKeydown(event: KeyboardEvent): void {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            this.menu?.show();
            return;
        }
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.menu?.show();
        }
    }
}
