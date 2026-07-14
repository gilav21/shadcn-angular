import {
    Directive,
    Injector,
    computed,
    effect,
    inject,
    input,
    output,
} from '@angular/core';
import { RichTextEditorAddonHost } from '../..';
import { createLocaleBindings, type LocaleInput } from '../../../../lib/i18n';
import { RichTextTablesButtonComponent } from './rich-text-tables-button.component';
import {
    RICH_TEXT_TABLES_BUTTON_CONTEXT,
    type RichTextTablesButtonContext,
} from './rich-text-tables.context';
import { RICH_TEXT_TABLES_LOCALES, type RichTextTablesLocale } from './rich-text-tables.locales';

const TABLE_SLOT_ID = 'tables.insert';

/**
 * Opt-in tables addon for `<ui-rich-text-editor>`. Attaches via DI to the
 * `RichTextEditorAddonHost` the base provides and contributes the table toolbar
 * button + 8×8 grid-picker popover as a component slot. Selecting a size builds
 * a `<table>` (a header row + body rows of empty cells, followed by a trailing
 * paragraph) and inserts it at the saved caret through the host's
 * `insertHtmlAtCaret` — one history entry, re-sanitized — reproducing the former
 * built-in exactly. The base editor ships no table-insert UI.
 *
 * Editing an existing table (add/delete rows and columns, merge cells, borders,
 * cell alignment and colour) stays in the base; this addon only adds the insert
 * UI. Table content keeps rendering with the base alone.
 *
 * Strings resolve from `[uiRteTablesLocale]` (a registry key or a full
 * dictionary) or the app-wide `UI_LOCALE_ID` token — NOT the editor's own
 * `[locale]` input.
 *
 * ```html
 * <ui-rich-text-editor uiRteTables />
 * ```
 */
@Directive({
    selector: 'ui-rich-text-editor[uiRteTables]',
    standalone: true,
})
export class RichTextTablesDirective {
    private readonly host = inject(RichTextEditorAddonHost);
    private readonly injector = inject(Injector);

    /** Locale for the addon UI: a registry key (`'en'`/`'he'`/…) or a full dictionary. */
    readonly uiRteTablesLocale = input<LocaleInput<RichTextTablesLocale>>();
    /** Sort order of the table button among addon toolbar slots; lower first. */
    readonly uiRteTablesOrder = input(330);

    /** Emits the inserted table's dimensions after it lands in the content. */
    readonly tableInsert = output<{ rows: number; cols: number }>();

    private readonly i18n = createLocaleBindings(this.uiRteTablesLocale, RICH_TEXT_TABLES_LOCALES);

    constructor() {
        const context: RichTextTablesButtonContext = {
            locale: computed(() => this.i18n.t()),
            onOpen: () => this.host.saveSelection(),
            onSelect: (rows, cols) => this.insertTable(rows, cols),
        };
        const slotInjector = Injector.create({
            providers: [{ provide: RICH_TEXT_TABLES_BUTTON_CONTEXT, useValue: context }],
            parent: this.injector,
        });
        effect((onCleanup) => {
            onCleanup(this.host.toolbarSlots.register({
                id: TABLE_SLOT_ID,
                order: this.uiRteTablesOrder(),
                component: RichTextTablesButtonComponent,
                injector: slotInjector,
            }));
        });
    }

    private insertTable(rows: number, cols: number): void {
        if (this.host.disabled() || this.host.readonly()) return;
        this.host.restoreSelection();
        this.host.insertHtmlAtCaret(tableHtml(rows, cols));
        this.tableInsert.emit({ rows, cols });
    }
}

/** Build the empty-table markup the former built-in inserted, verbatim. */
function tableHtml(rows: number, cols: number): string {
    const headerCells = Array.from({ length: cols }, () => '<th><br></th>').join('');
    const bodyRow = '<tr>' + Array.from({ length: cols }, () => '<td><br></td>').join('') + '</tr>';
    const bodyRows = Array.from({ length: rows - 1 }, () => bodyRow).join('');
    return `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table><p><br></p>`;
}
