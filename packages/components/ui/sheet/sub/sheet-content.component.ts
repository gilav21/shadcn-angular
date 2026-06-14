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
import { COMMON_LOCALES, type CommonLocale, createLocaleBindings, type LocaleInput } from '../../../lib/i18n';
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

    readonly side = input<SheetSide>('right');
    readonly class = input('');
    readonly title = input<string>();
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

    onOverlayClick(): void {
        this.sheet?.hide();
    }

    close(): void {
        this.sheet?.hide();
    }
}
