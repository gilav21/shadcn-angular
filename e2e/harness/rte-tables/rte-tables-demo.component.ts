import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RichTextEditorComponent } from '@/components/ui/rich-text-editor';
import { RichTextTablesDirective } from '@/components/ui/rich-text-editor/addons/tables';

/**
 * Exercises the `rich-text-editor/tables` addon end-to-end in a real consumer
 * install: the base editor ships no table-insert UI; the addon contributes the
 * table toolbar button + 8×8 grid picker as a component slot through
 * `RichTextEditorAddonHost`, and inserts the table via the `insertHtmlAtCaret`
 * host seam.
 */
@Component({
    selector: 'app-rte-tables-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, RichTextEditorComponent, RichTextTablesDirective],
    template: `
        <main class="p-8 space-y-6">
            <section>
                <h2 class="mb-2 font-semibold">Editor with tables addon</h2>
                <ui-rich-text-editor
                    data-testid="editor"
                    mode="html"
                    uiRteTables
                    (tableInsert)="lastInsert.set($event.rows + 'x' + $event.cols)"
                    [ngModel]="content()"
                    (ngModelChange)="content.set($event)"
                />
                <pre data-testid="editor-html" class="sr-only">{{ content() }}</pre>
                <pre data-testid="last-insert" class="sr-only">{{ lastInsert() }}</pre>
            </section>

            <section>
                <h2 class="mb-2 font-semibold">Editor without the addon</h2>
                <ui-rich-text-editor data-testid="editor-plain" mode="html" />
            </section>
        </main>
    `,
})
export class RteTablesDemoComponent {
    protected readonly content = signal('<p>Place the caret here, then insert a table.</p>');
    protected readonly lastInsert = signal('');
}
