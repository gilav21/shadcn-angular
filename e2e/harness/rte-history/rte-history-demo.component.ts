import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RichTextEditorComponent } from '@/components/ui/rich-text-editor';
import { RichTextHistoryDirective } from '@/components/ui/rich-text-editor/addons/history';

/**
 * Exercises the `rich-text-editor/history` addon end-to-end in a real consumer
 * install: the base editor keeps the undo/redo stack but ships no revision-
 * history UI and no `dialog` dependency; the addon contributes the "Revisions"
 * corner button + panel, the preview dialog, and the browser dialog through
 * `RichTextEditorAddonHost`. A second editor without the addon proves the corner
 * button only appears where `uiRteHistory` is applied.
 */
@Component({
    selector: 'app-rte-history-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, RichTextEditorComponent, RichTextHistoryDirective],
    template: `
        <main class="p-8 space-y-6">
            <section>
                <h2 class="mb-2 font-semibold">Editor with history addon</h2>
                <ui-rich-text-editor
                    data-testid="editor"
                    mode="html"
                    uiRteHistory
                    [historyDebounceMs]="150"
                    [ngModel]="content()"
                    (ngModelChange)="content.set($event)"
                />
                <pre data-testid="editor-html" class="sr-only">{{ content() }}</pre>
            </section>

            <section>
                <h2 class="mb-2 font-semibold">Editor without the addon</h2>
                <ui-rich-text-editor
                    data-testid="editor-plain"
                    mode="html"
                    [ngModel]="plainContent()"
                    (ngModelChange)="plainContent.set($event)"
                />
            </section>
        </main>
    `,
})
export class RteHistoryDemoComponent {
    protected readonly content = signal('<p>first</p>');
    protected readonly plainContent = signal('<p>Plain editor, no addon.</p>');
}
