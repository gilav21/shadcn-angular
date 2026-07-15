import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RichTextEditorComponent } from '@/components/ui/rich-text-editor';
import { RichTextActionsDirective, type RichTextActionDefinition } from '@/components/ui/rich-text-editor/addons/actions';
import { RichTextAiDirective } from '@/components/ui/rich-text-editor/addons/ai';
import { RichTextColorsDirective } from '@/components/ui/rich-text-editor/addons/colors';
import { RichTextEmojiDirective } from '@/components/ui/rich-text-editor/addons/emoji';
import { RichTextFileImportDirective } from '@/components/ui/rich-text-editor/addons/file-import';
import { RichTextHistoryDirective } from '@/components/ui/rich-text-editor/addons/history';
import { RichTextImagesDirective } from '@/components/ui/rich-text-editor/addons/images';
import { RichTextLinksDirective } from '@/components/ui/rich-text-editor/addons/links';
import { RichTextMentionsDirective, type MentionItem, type RichTextEntitySearchFn } from '@/components/ui/rich-text-editor/addons/mentions';
import { RichTextOutlineDirective } from '@/components/ui/rich-text-editor/addons/outline';
import { RichTextSlashCommandsDirective } from '@/components/ui/rich-text-editor/addons/slash-commands';
import { RichTextTablesDirective } from '@/components/ui/rich-text-editor/addons/tables';
import { RichTextTypographyDirective } from '@/components/ui/rich-text-editor/addons/typography';

/**
 * Composition harness: ONE editor carrying ALL THIRTEEN addons at once, in a
 * real consumer install. Proves the opt-in model composes — toolbar slots
 * from nine addons render together, the slash menu aggregates commands
 * registered by three other addons (links, ai, outline), and the
 * overlay-based features (history, outline, mentions, ai) coexist on the
 * same overlayAnchor. The second editor is the control: no addons, no
 * addon UI.
 */
@Component({
    selector: 'app-rte-all-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule, RichTextEditorComponent,
        RichTextActionsDirective, RichTextAiDirective, RichTextColorsDirective,
        RichTextEmojiDirective, RichTextFileImportDirective, RichTextHistoryDirective,
        RichTextImagesDirective, RichTextLinksDirective, RichTextMentionsDirective,
        RichTextOutlineDirective, RichTextSlashCommandsDirective, RichTextTablesDirective,
        RichTextTypographyDirective,
    ],
    template: `
        <main class="p-8 space-y-6">
            <section>
                <h2 class="mb-2 font-semibold">Everything editor</h2>
                <ui-rich-text-editor
                    data-testid="editor-all"
                    mode="html"
                    [uiRteActions]="actionDefs"
                    [uiRteAi]="mockAi"
                    uiRteColors
                    uiRteEmoji
                    uiRteFileImport
                    uiRteHistory
                    uiRteImages
                    uiRteLinks
                    uiRteMentions
                    [uiRteMentionsSearch]="searchMentions"
                    uiRteOutline
                    uiRteSlashCommands
                    uiRteTables
                    uiRteTypography
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
