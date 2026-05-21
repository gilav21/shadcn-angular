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
import { NgTemplateOutlet } from '@angular/common';
import { DOCUMENT } from '@angular/common';
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

    registerRoot(el: HTMLElement) {
        this.rootEl = el;
    }

    registerTrigger(el: HTMLElement) {
        this.triggerRef = el;
    }

    focusTrigger() {
        this.triggerRef?.focus();
    }

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

    items = input<DropdownItem[]>([]);
    open = model(false);

    constructor() {
        this.document.addEventListener('click', this.clickListener);
        this.service.registerRoot(this.el.nativeElement);
    }

    private readonly clickListener = (event: MouseEvent) => {
        if (!this.el.nativeElement.contains(event.target)) {
            this.hide();
        }
    };

    ngOnDestroy() {
        this.document.removeEventListener('click', this.clickListener);
    }

    toggle() {
        this.open.update(v => !v);
    }

    show() {
        this.open.set(true);
    }

    hide() {
        this.open.set(false);
    }
}
