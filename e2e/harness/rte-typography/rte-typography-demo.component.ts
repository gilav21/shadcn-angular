import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RichTextEditorComponent } from '@/components/ui/rich-text-editor';
import { RichTextTypographyDirective } from '@/components/ui/rich-text-editor/addons/typography';

/**
 * Exercises the `rich-text-editor/typography` addon end-to-end in a real
 * consumer install: the base editor ships no font-size/font-family toolbar code
 * and no `autocomplete` dependency; the addon contributes the font-size and
 * font-family toolbar buttons as component slots through
 * `RichTextEditorAddonHost`, and a pick applies an inline font style to the
 * selection via the `applyInlineStyle` host seam.
 */
@Component({
    selector: 'app-rte-typography-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, RichTextEditorComponent, RichTextTypographyDirective],
    template: `
        <main class="p-8 space-y-6">
            <section>
                <h2 class="mb-2 font-semibold">Editor with typography addon</h2>
                <ui-rich-text-editor
                    data-testid="editor"
                    mode="html"
                    uiRteTypography
                    (fontSizeSelect)="lastSize.set($event)"
                    (fontFamilySelect)="lastFamily.set($event)"
                    [ngModel]="content()"
                    (ngModelChange)="content.set($event)"
                />
                <pre data-testid="editor-html" class="sr-only">{{ content() }}</pre>
                <pre data-testid="last-size" class="sr-only">{{ lastSize() }}</pre>
                <pre data-testid="last-family" class="sr-only">{{ lastFamily() }}</pre>
            </section>

            <section>
                <h2 class="mb-2 font-semibold">Editor without the addon</h2>
                <ui-rich-text-editor data-testid="editor-plain" mode="html" />
            </section>
        </main>
    `,
})
export class RteTypographyDemoComponent {
    protected readonly content = signal('<p>Style this text.</p>');
    protected readonly lastSize = signal('');
    protected readonly lastFamily = signal('');
}
