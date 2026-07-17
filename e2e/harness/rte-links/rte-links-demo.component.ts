import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RichTextEditorComponent } from '@/components/ui/rich-text-editor';
import { RichTextLinksDirective } from '@/components/ui/rich-text-editor/addons/links';

/**
 * Exercises the `rich-text-editor/links` addon end-to-end in a real consumer
 * install: the base editor ships no link UI (its `showLinkDialog` is inert); the
 * addon contributes the link toolbar button + popover as a component slot
 * through `RichTextEditorAddonHost`, validates + sanitizes the URL, and inserts
 * the anchor via the `insertHtmlAtCaret` host seam.
 */
@Component({
    selector: 'app-rte-links-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, RichTextEditorComponent, RichTextLinksDirective],
    template: `
        <main class="p-8 space-y-6">
            <section>
                <h2 class="mb-2 font-semibold">Editor with links addon</h2>
                <ui-rich-text-editor
                    data-testid="editor"
                    mode="html"
                    uiRteLinks
                    (linkInsert)="lastInsert.set($event.url)"
                    (linkRemove)="lastRemove.set($event.url)"
                    [ngModel]="content()"
                    (ngModelChange)="content.set($event)"
                />
                <pre data-testid="editor-html" class="sr-only">{{ content() }}</pre>
                <pre data-testid="last-insert" class="sr-only">{{ lastInsert() }}</pre>
                <pre data-testid="last-remove" class="sr-only">{{ lastRemove() }}</pre>
            </section>

            <section>
                <h2 class="mb-2 font-semibold">Editor without the addon</h2>
                <ui-rich-text-editor data-testid="editor-plain" mode="html" />
            </section>
        </main>
    `,
})
export class RteLinksDemoComponent {
    protected readonly content = signal('<p>Select this text to link.</p>');
    protected readonly lastInsert = signal('');
    protected readonly lastRemove = signal('');
}
