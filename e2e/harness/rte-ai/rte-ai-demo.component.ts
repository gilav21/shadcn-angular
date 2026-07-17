import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RichTextEditorComponent } from '@/components/ui/rich-text-editor';
import { RichTextAiDirective } from '@/components/ui/rich-text-editor/addons/ai';
import type { AiProvider } from '@/components/lib/ai';

/**
 * Exercises the `rich-text-editor/ai` addon end-to-end in a real consumer
 * install: the base editor ships no AI UI; the addon contributes the selection
 * chip, the task panel, and the `/ai` slash command through
 * `RichTextEditorAddonHost`, and streams a provider's output into the editor.
 * That the harness compiles at all proves the addon builds under AOT in a plain
 * consumer app (no workspace dedup) with its own `ai.ts` lib file.
 */
@Component({
    selector: 'app-rte-ai-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, RichTextEditorComponent, RichTextAiDirective],
    template: `
        <main class="p-8 space-y-6">
            <section>
                <h2 class="mb-2 font-semibold">Editor with AI addon</h2>
                <ui-rich-text-editor
                    data-testid="editor"
                    mode="html"
                    [uiRteAi]="provider"
                    (aiResult)="lastResult.set($event)"
                    [ngModel]="content()"
                    (ngModelChange)="content.set($event)"
                />
                <pre data-testid="editor-html" class="sr-only">{{ content() }}</pre>
                <pre data-testid="last-result" class="sr-only">{{ lastResult() }}</pre>
            </section>

            <section>
                <h2 class="mb-2 font-semibold">Editor without the addon</h2>
                <ui-rich-text-editor data-testid="editor-plain" mode="html" />
            </section>
        </main>
    `,
})
export class RteAiDemoComponent {
    protected readonly content = signal('<p>Select this sentence and ask AI.</p>');
    protected readonly lastResult = signal('');

    /** One-shot mock provider — returns a canned transformation, no network. */
    protected readonly provider: AiProvider = (req) => `AI[${req.input}]`;
}
