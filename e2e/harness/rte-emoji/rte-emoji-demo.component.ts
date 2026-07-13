import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RichTextEditorComponent } from '@/components/ui/rich-text-editor';
import { RichTextEmojiDirective } from '@/components/ui/rich-text-editor/addons/emoji';

/**
 * Exercises the `rich-text-editor/emoji` addon end-to-end in a real consumer
 * install: the base editor ships no emoji code and no `emoji-picker`
 * dependency; the addon contributes the emoji picker toolbar button as a
 * component slot through `RichTextEditorAddonHost`, and a pick lands in the
 * editor content via the `insertTextFromOverlay` host seam.
 */
@Component({
    selector: 'app-rte-emoji-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, RichTextEditorComponent, RichTextEmojiDirective],
    template: `
        <main class="p-8 space-y-6">
            <section>
                <h2 class="mb-2 font-semibold">Editor with emoji addon</h2>
                <ui-rich-text-editor
                    data-testid="editor"
                    mode="html"
                    uiRteEmoji
                    (emojiInsert)="lastEmoji.set($event)"
                    [ngModel]="content()"
                    (ngModelChange)="content.set($event)"
                />
                <pre data-testid="editor-html" class="sr-only">{{ content() }}</pre>
                <pre data-testid="last-emoji" class="sr-only">{{ lastEmoji() }}</pre>
            </section>

            <section>
                <h2 class="mb-2 font-semibold">Editor without the addon</h2>
                <ui-rich-text-editor data-testid="editor-plain" mode="html" />
            </section>
        </main>
    `,
})
export class RteEmojiDemoComponent {
    protected readonly content = signal('<p>Pick an emoji.</p>');
    protected readonly lastEmoji = signal('');
}
