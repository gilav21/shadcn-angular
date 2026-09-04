import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RichTextEditorComponent } from '@/components/ui/rich-text-editor';

/**
 * The BASE editor in a pristine consumer install — no addon installed, nothing
 * imported from `addons/`. The 14 `rte-*` harnesses each prove one addon; this
 * one proves the 4.6k-line base itself still works when installed alone: table
 * editing, find & replace, undo/redo, markdown round-trip, and forms.
 *
 * Everything here must stay addon-free. Table *editing* (the context menu) is
 * base; table *insertion* is the `tables` addon and belongs in `rte-tables`.
 */
@Component({
    selector: 'app-rich-text-editor-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, ReactiveFormsModule, RichTextEditorComponent],
    template: `
        <main class="p-8 space-y-6">
            <section>
                <h2 class="mb-2 font-semibold">HTML mode, ngModel</h2>
                <ui-rich-text-editor
                    data-testid="editor"
                    mode="html"
                    [ngModel]="html()"
                    (ngModelChange)="html.set($event)"
                />
                <pre data-testid="editor-html" class="sr-only">{{ html() }}</pre>
            </section>

            <section>
                <h2 class="mb-2 font-semibold">Markdown mode</h2>
                <ui-rich-text-editor
                    data-testid="editor-markdown"
                    mode="markdown"
                    [ngModel]="markdown()"
                    (ngModelChange)="markdown.set($event)"
                />
                <pre data-testid="editor-markdown-output" class="sr-only">{{ markdown() }}</pre>
            </section>

            <section>
                <h2 class="mb-2 font-semibold">Markdown mode, empty</h2>
                <ui-rich-text-editor
                    data-testid="editor-markdown-empty"
                    mode="markdown"
                    placeholder="Write something..."
                    [ngModel]="emptyMarkdown()"
                    (ngModelChange)="emptyMarkdown.set($event)"
                />
                <pre data-testid="editor-markdown-empty-output" class="sr-only">{{ emptyMarkdown() }}</pre>
            </section>

            <section>
                <h2 class="mb-2 font-semibold">Reactive form</h2>
                <ui-rich-text-editor
                    data-testid="editor-form"
                    mode="html"
                    [disabled]="inputDisabled()"
                    [formControl]="control"
                />
                <pre data-testid="form-value" class="sr-only">{{ control.value }}</pre>
                <button type="button" data-testid="toggle-form-disabled" (click)="toggleFormDisabled()">
                    toggle control.disable()
                </button>
                <button type="button" data-testid="toggle-input-disabled" (click)="toggleInputDisabled()">
                    toggle [disabled]
                </button>
            </section>
        </main>
    `,
})
export class RichTextEditorDemoComponent {
    /** Two `Hello` occurrences (find/replace) and a 2×2 table (context menu). */
    protected readonly html = signal(
        '<p>Hello world. Hello again.</p>'
        + '<table><tbody><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></tbody></table>',
    );
    protected readonly markdown = signal('# Title\n\nSome **bold** text');
    protected readonly emptyMarkdown = signal('');
    protected readonly control = new FormControl('<p>form</p>', { nonNullable: true });

    /** The `[disabled]` input — one of the two independent locking paths. */
    protected readonly inputDisabled = signal(false);

    /**
     * `control.disable()` / `enable()`. Reaches the editor through the CVA's
     * `setDisabledState`, which OR-s with the `[disabled]` input — so either
     * path locks the editor and neither overrides the other.
     */
    protected toggleFormDisabled(): void {
        if (this.control.disabled) {
            this.control.enable();
        } else {
            this.control.disable();
        }
    }

    protected toggleInputDisabled(): void {
        this.inputDisabled.update(v => !v);
    }
}
