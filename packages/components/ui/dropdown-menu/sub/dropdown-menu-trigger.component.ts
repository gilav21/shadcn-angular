import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    inject,
    ViewChild,
} from '@angular/core';
import { DROPDOWN_MENU, DropdownMenuService } from '../dropdown-menu.component';

@Component({
    selector: 'ui-dropdown-menu-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span
      #trigger
      role="button"
      tabindex="0"
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
    private readonly el = inject(ElementRef);

    @ViewChild('trigger') triggerEl!: ElementRef<HTMLElement>;

    constructor() {
        setTimeout(() => {
            const triggerButton = (this.el.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-slot="dropdown-trigger"]');
            if (triggerButton) {
                this.service.registerTrigger(triggerButton);
            }
        });
    }

    onClick(event: MouseEvent): void {
        event.stopPropagation();
        this.menu?.toggle();
    }

    onKeydown(event: KeyboardEvent): void {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
            event.preventDefault();
            this.menu?.show();
        }
    }
}
