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
    /**
     * Extra classes merged onto the panel (not the backdrop), after the
     * direction variant — pass sizing utilities here to override the default
     * `max-h-[80vh]` / `w-3/4 sm:max-w-sm`. The slide-in edge is not settable
     * here; set `[direction]` on the parent `ui-drawer`.
     */
    class = input('');
    /**
     * Simple mode: renders a `ui-drawer-header`/`ui-drawer-title` above the
     * projected content. Leave unset and project your own header instead;
     * {@link description} is only rendered when this is set.
     */
    title = input<string>();
    /** Simple-mode sub-heading. Only rendered when {@link title} is also set. */
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

    ngAfterViewInit(): void {
        if (this.drawer?.open()) {
            this.focusFirstElement();
        }
    }

    private focusFirstElement(): void {
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

    /**
     * Backdrop click handler — the drawer is dismissible by clicking outside.
     * Bound to the overlay button only, so panel clicks never reach it.
     */
    onOverlayClick(): void {
        this.drawer?.hide();
    }

    /**
     * Key handler on the modal wrapper: Escape closes the drawer, Tab/Shift+Tab
     * wrap focus so it stays trapped inside the panel. The panel renders inline
     * at `z-50`, not in the native top layer, so higher-z UI can cover it.
     */
    onKeydown(event: KeyboardEvent): void {
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
