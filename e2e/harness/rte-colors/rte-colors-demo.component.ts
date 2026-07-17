import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RichTextEditorComponent } from '@/components/ui/rich-text-editor';
import { RichTextColorsDirective, type RichTextColorChange } from '@/components/ui/rich-text-editor/addons/colors';

/**
 * Exercises the `rich-text-editor/colors` addon end-to-end in a real consumer
 * install: the base editor ships no colour code and no `color-picker`
 * dependency; the addon contributes the text-colour and highlight-colour
 * toolbar buttons as component slots through `RichTextEditorAddonHost`, and a
 * pick applies an inline colour style to the selection via the
 * `applyInlineStyle` host seam.
 */
@Component({
    selector: 'app-rte-colors-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, RichTextEditorComponent, RichTextColorsDirective],
    template: `
        <main class="p-8 space-y-6">
            <section>
                <h2 class="mb-2 font-semibold">Editor with colours addon</h2>
                <ui-rich-text-editor
                    data-testid="editor"
                    mode="html"
                    uiRteColors
                    (colorChange)="lastColor.set($event)"
                    [ngModel]="content()"
                    (ngModelChange)="content.set($event)"
                />
                <pre data-testid="editor-html" class="sr-only">{{ content() }}</pre>
                <pre data-testid="last-color" class="sr-only">{{ lastColor()?.type }}:{{ lastColor()?.color }}</pre>
            </section>

            <section>
                <h2 class="mb-2 font-semibold">Editor without the addon</h2>
                <ui-rich-text-editor data-testid="editor-plain" mode="html" />
            </section>
        </main>
    `,
})
export class RteColorsDemoComponent {
    protected readonly content = signal('<p>Colour this text.</p>');
    protected readonly lastColor = signal<RichTextColorChange | null>(null);
}
