import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
    RichTextEditorComponent,
    RTE_FULL,
    type MentionItem,
    type RichTextActionDefinition,
    type RichTextEntitySearchFn,
} from '@gilav21/shadcn-angular-rte';

/**
 * The `rte-all` composition page, driven from the COMPILED npm package instead
 * of CLI-copied sources. Same editor, same 13 addons through one `uiRteFull`
 * marker, same control editor — so any behavioural difference between the two
 * distribution models shows up as a diff in this spec's assertions rather than
 * as a mystery in a consumer's app.
 *
 * Everything here is imported from the package's single entry point, including
 * the TYPES (`RichTextActionDefinition`, `MentionItem`, `RichTextEntitySearchFn`).
 * That is UC-3: in the copy model those live in per-addon barrels, and the
 * generated `public-api.ts` is what makes them reachable from one specifier.
 */
@Component({
    selector: 'app-pkg-rte-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, RichTextEditorComponent, RTE_FULL],
    template: `
        <main class="p-8 space-y-6">
            <section>
                <h2 class="mb-2 font-semibold">Package editor (all addons)</h2>
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
export class PkgRteDemoComponent {
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
