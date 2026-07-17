import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RichTextEditorComponent } from '@/components/ui/rich-text-editor';
import { RTE_FULL } from '@/components/ui/rich-text-editor/addons/full';
import type { RichTextActionDefinition } from '@/components/ui/rich-text-editor/addons/actions';
import type { MentionItem, RichTextEntitySearchFn } from '@/components/ui/rich-text-editor/addons/mentions';

/**
 * Composition harness: ONE editor carrying ALL THIRTEEN addons at once through
 * the single `uiRteFull` marker attribute, in a real consumer install. Importing
 * the generated `RTE_FULL` array registers every addon directive; each also
 * matches on `[uiRteFull]`, so one attribute activates them all. Proves the
 * composition works — toolbar slots from nine addons render together, the slash
 * menu aggregates commands registered by three other addons (links, ai,
 * outline), and the overlay-based features (history, outline, mentions, ai)
 * coexist on the same overlayAnchor — while each addon's inputs/outputs bind
 * natively on the editor element. The second editor is the control: no marker,
 * no addon UI.
 */
@Component({
    selector: 'app-rte-all-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, RichTextEditorComponent, RTE_FULL],
    template: `
        <main class="p-8 space-y-6">
            <section>
                <h2 class="mb-2 font-semibold">Everything editor</h2>
                <ui-rich-text-editor
                    data-testid="editor-all"
                    mode="html"
                    uiRteFull
                    [uiRteActions]="actionDefs"
                    [uiRteAi]="mockAi"
                    [uiRteMentionsSearch]="searchMentions"
                    [ngModel]="content()"
                    (ngModelChange)="content.set($event)"
                />
                <pre data-testid="editor-all-html" class="sr-only">{{ content() }}</pre>
            </section>

            <section>
                <h2 class="mb-2 font-semibold">Control editor (no addons)</h2>
                <ui-rich-text-editor data-testid="editor-plain" mode="html" />
            </section>
        </main>
    `,
})
export class RteAllDemoComponent {
    protected readonly content = signal('<h1>Doc title</h1><p>Body text to select.</p>');

    protected readonly actionDefs: RichTextActionDefinition[] = [
        {
            id: 'open-dialog', label: 'Open dialog', triggers: ['click'],
            fields: [{ key: 'dialogId', label: 'Dialog', type: 'text', required: true }],
        },
    ];

    protected readonly mockAi = (_request: unknown): Promise<string> =>
        new Promise((resolve) => setTimeout(() => resolve('AI SAYS HELLO'), 10));

    protected readonly searchMentions: RichTextEntitySearchFn<MentionItem> = (query) =>
        [{ id: '1', value: 'user-one', label: `User ${query || 'One'}` }];
}
