import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    DestroyRef,
    signal,
} from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { cn } from '../../../../lib/utils';
import { RichTextEditorAddonHost, RichTextToolbarViewContext } from '../..';
import {
    PopoverComponent,
    PopoverTriggerComponent,
    PopoverContentComponent,
} from '../../../popover';
import { RICH_TEXT_TABLES_BUTTON_CONTEXT } from './rich-text-tables.context';

const TABLE_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 3v18"/><path d="M3 12h18"/><rect width="18" height="18" x="3" y="3" rx="2"/></svg>';

/**
 * The table toolbar button the tables addon contributes as a component slot: a
 * standard toolbar button anchoring a popover with an 8×8 grid picker. Reads
 * editor state through {@link RichTextEditorAddonHost} and its locale + open +
 * select callbacks through {@link RICH_TEXT_TABLES_BUTTON_CONTEXT}.
 */
@Component({
    selector: 'ui-rte-tables-button',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        PopoverComponent,
        PopoverTriggerComponent,
        PopoverContentComponent,
    ],
    templateUrl: './rich-text-tables-button.component.html',
    host: { class: 'contents' },
})
export class RichTextTablesButtonComponent {
    private readonly host = inject(RichTextEditorAddonHost);
    private readonly domSanitizer = inject(DomSanitizer);
    private readonly toolbarView = inject(RichTextToolbarViewContext, { optional: true });
    protected readonly context = inject(RICH_TEXT_TABLES_BUTTON_CONTEXT);

    protected readonly gridRange: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8];

    protected readonly open = signal(false);
    /** Membership in the toolbar's single-open-panel group. */
    private readonly exclusive = this.host.registerExclusivePopover(() => this.open.set(false));

    constructor() {
        inject(DestroyRef).onDestroy(() => this.exclusive.release());
    }
    protected readonly hoverRows = signal(0);
    protected readonly hoverCols = signal(0);

    protected readonly icon: SafeHtml = this.domSanitizer.bypassSecurityTrustHtml(TABLE_ICON);

    protected readonly interactionDisabled = computed(
        () => this.host.isDisabled() || this.host.readonly(),
    );

    protected readonly buttonClasses = computed(() => cn(
        'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        // The global (pointer: coarse) floor targets `button:not([data-slot])`,
        // and these addon buttons carry a data-slot for testing — so they must
        // state the 44px touch minimum themselves rather than inherit it.
        'pointer-coarse:min-h-11 pointer-coarse:min-w-11',
        this.toolbarView?.compact() ? 'p-1' : 'p-1.5',
    ));

    protected onOpenChange(next: boolean): void {
        if (next) {
            this.exclusive.notifyOpened();
            this.context.onOpen();
        } else {
            this.resetHover();
        }
        this.open.set(next);
    }

    protected onHover(rows: number, cols: number): void {
        this.hoverRows.set(rows);
        this.hoverCols.set(cols);
    }

    protected onSelect(rows: number, cols: number): void {
        if (this.interactionDisabled()) return;
        this.context.onSelect(rows, cols);
        this.open.set(false);
        this.resetHover();
    }

    private resetHover(): void {
        this.hoverRows.set(0);
        this.hoverCols.set(0);
    }
}
