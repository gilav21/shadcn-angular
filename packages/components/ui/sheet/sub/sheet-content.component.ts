import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    ElementRef,
    inject,
    input,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { createLocaleBindings, type LocaleInput } from '../../../lib/i18n';
import { COMMON_LOCALES, type CommonLocale } from '../../../lib/i18n/common.locales';
import { SHEET, sheetVariants, SheetSide } from '../sheet.component';
import { SheetHeaderComponent } from './sheet-header.component';
import { SheetTitleComponent } from './sheet-title.component';
import { SheetDescriptionComponent } from './sheet-description.component';

@Component({
    selector: 'ui-sheet-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        SheetHeaderComponent,
        SheetTitleComponent,
        SheetDescriptionComponent,
    ],
    template: `
    @if (sheet?.open()) {
      <div
        class="fixed inset-0 z-50"
        role="dialog"
        aria-modal="true"
        [attr.dir]="dir()"
        (keydown)="onKeydown($event)"
      >
        <div
          class="fixed inset-0 bg-black/50 animate-in fade-in-0"
          [attr.data-slot]="'sheet-overlay'"
          (click)="onOverlayClick()"
          aria-hidden="true"
        ></div>
        <div
          #contentEl
          [class]="classes()"
          [attr.data-slot]="'sheet-content'"
          [attr.data-state]="'open'"
          tabindex="-1"
        >
          @if (title()) {
            <ui-sheet-header>
              <ui-sheet-title>{{ title() }}</ui-sheet-title>
              @if (description()) {
                <ui-sheet-description>{{ description() }}</ui-sheet-description>
              }
            </ui-sheet-header>
          }
          <ng-content />
          <button
            type="button"
            class="absolute ltr:right-4 rtl:left-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            (click)="close()"
            [attr.aria-label]="t().close"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span class="sr-only">{{ t().close }}</span>
          </button>
        </div>
      </div>
    }
  `,
    host: { class: 'contents' },
})
export class SheetContentComponent implements AfterViewInit {
    readonly sheet = inject(SHEET, { optional: true });
    private readonly el = inject(ElementRef);

    /**
     * Edge the panel is docked to. `left`/`right` give a full-height panel
     * (75% wide, capped at `sm:max-w-sm`); `top`/`bottom` span the full width
     * and are sized by their content. The horizontal sides are mirrored
     * automatically in RTL.
     */
    readonly side = input<SheetSide>('right');
    /**
     * Extra classes merged onto the panel (not the backdrop), after the
     * {@link side} variant — pass width/height utilities here to override the
     * default `w-3/4 sm:max-w-sm` sizing.
     */
    readonly class = input('');
    /**
     * Simple mode: renders a `ui-sheet-header`/`ui-sheet-title` above the
     * projected content. Leave unset and project your own header instead;
     * {@link description} is only rendered when this is set.
     */
    readonly title = input<string>();
    /** Simple-mode sub-heading. Only rendered when {@link title} is also set. */
    readonly description = input<string>();

    /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
    readonly locale = input<LocaleInput<CommonLocale>>();

    private readonly i18n = createLocaleBindings(this.locale, COMMON_LOCALES);
    protected readonly t = this.i18n.t;
    protected readonly dir = this.i18n.dir;

    private contentEl?: HTMLElement;
    private previousActiveElement?: Element | null;

    constructor() {
        effect(() => {
            if (this.sheet?.open()) {
                this.previousActiveElement = document.activeElement;
                setTimeout(() => this.focusFirstElement(), 0);
            } else if (this.previousActiveElement instanceof HTMLElement) {
                this.previousActiveElement.focus();
            }
        });
    }

    ngAfterViewInit(): void {
        if (this.sheet?.open()) {
            this.focusFirstElement();
        }
    }

    private focusFirstElement(): void {
        const content = this.el.nativeElement.querySelector('[data-slot="sheet-content"]');
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

    /**
     * Key handler on the modal wrapper: Escape closes the sheet, Tab/Shift+Tab
     * wrap focus so it stays trapped inside the panel. The panel renders inline
     * at `z-50`, not in the native top layer, so higher-z UI can cover it.
     */
    onKeydown(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            event.preventDefault();
            this.sheet?.hide();
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

    classes = computed(() =>
        cn(sheetVariants({ side: this.side() }), this.class())
    );

    /**
     * Backdrop click handler — the sheet is dismissible by clicking outside.
     * Bound to the overlay element only, so panel clicks never reach it.
     */
    onOverlayClick(): void {
        this.sheet?.hide();
    }

    /**
     * Closes the owning `ui-sheet` (restoring focus to the element that opened
     * it). Bound to the built-in corner close button; a no-op when this content
     * is used outside a `ui-sheet`.
     */
    close(): void {
        this.sheet?.hide();
    }
}
