import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
    effect,
    ElementRef,
    AfterViewInit,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { DRAWER, drawerVariants } from '../drawer.component';
import { DrawerHeaderComponent } from './drawer-header.component';
import { DrawerTitleComponent } from './drawer-title.component';
import { DrawerDescriptionComponent } from './drawer-description.component';

@Component({
    selector: 'ui-drawer-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DrawerHeaderComponent,
        DrawerTitleComponent,
        DrawerDescriptionComponent,
    ],
    templateUrl: './drawer-content.component.html',
    host: { class: 'contents' },
})
export class DrawerContentComponent implements AfterViewInit {
    readonly drawer = inject(DRAWER, { optional: true });
    private readonly el = inject(ElementRef);
    class = input('');
    title = input<string>();
    description = input<string>();

    private contentEl?: HTMLElement;
    private previousActiveElement?: Element | null;

    constructor() {
        effect(() => {
            if (this.drawer?.open()) {
                this.previousActiveElement = document.activeElement;
                setTimeout(() => this.focusFirstElement(), 0);
            } else if (this.previousActiveElement instanceof HTMLElement) {
                this.previousActiveElement.focus();
            }
        });
    }

    ngAfterViewInit() {
        if (this.drawer?.open()) {
            this.focusFirstElement();
        }
    }

    private focusFirstElement() {
        const content = this.el.nativeElement.querySelector('[data-slot="drawer-content"]');
        if (content) {
            this.contentEl = content;
            const focusable = content.querySelector(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            ) as HTMLElement;
            if (focusable) {
                focusable.focus();
            } else {
                content.focus();
            }
        }
    }

    direction = computed(() => this.drawer?.direction() ?? 'bottom');

    classes = computed(() => cn(
        drawerVariants({ direction: this.direction() }),
        this.class()
    ));

    onOverlayClick() {
        this.drawer?.hide();
    }

    onKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            event.preventDefault();
            this.drawer?.hide();
            return;
        }

        if (event.key === 'Tab' && this.contentEl) {
            const focusableElements = this.contentEl.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            const firstElement = focusableElements[0] as HTMLElement;
            const lastElement = Array.from(focusableElements).at(-1) as HTMLElement;

            if (event.shiftKey) {
                if (document.activeElement === firstElement) {
                    event.preventDefault();
                    lastElement?.focus();
                }
            } else if (document.activeElement === lastElement) {
                    event.preventDefault();
                    firstElement?.focus();
                }
        }
    }
}
