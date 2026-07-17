import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RichTextEditorComponent } from '@/components/ui/rich-text-editor';
import { RichTextFileImportDirective } from '@/components/ui/rich-text-editor/addons/file-import';

/**
 * Exercises the `rich-text-editor/file-import` addon end-to-end in a real
 * consumer install: the base editor ships no import UI or DOCX/PDF parser code;
 * the addon contributes the import toolbar button as a component slot through
 * `RichTextEditorAddonHost`, lazy-loads the parsers, and inserts through the
 * `insertHtmlAtCaret` host seam. That the harness compiles at all proves the
 * addon builds under AOT in a plain consumer app (no workspace dedup) with its
 * own parser lib files.
 */
@Component({
    selector: 'app-rte-file-import-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, RichTextEditorComponent, RichTextFileImportDirective],
    template: `
        <main class="p-8 space-y-6">
            <section>
                <h2 class="mb-2 font-semibold">Editor with file-import addon</h2>
                <ui-rich-text-editor
                    data-testid="editor"
                    mode="html"
                    uiRteFileImport
                    (fileImportComplete)="lastImport.set($event)"
                    [ngModel]="content()"
                    (ngModelChange)="content.set($event)"
                />
                <pre data-testid="editor-html" class="sr-only">{{ content() }}</pre>
                <pre data-testid="last-import" class="sr-only">{{ lastImport() }}</pre>
            </section>

            <section>
                <h2 class="mb-2 font-semibold">Editor without the addon</h2>
                <ui-rich-text-editor data-testid="editor-plain" mode="html" />
            </section>
        </main>
    `,
})
export class RteFileImportDemoComponent {
    protected readonly content = signal('<p>Place the caret here, then import a document.</p>');
    protected readonly lastImport = signal('');
}
