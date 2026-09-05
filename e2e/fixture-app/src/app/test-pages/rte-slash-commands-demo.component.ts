import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RichTextEditorComponent, type RichTextSlashCommand } from '@/components/ui/rich-text-editor';
import { RichTextSlashCommandsDirective } from '@/components/ui/rich-text-editor/addons/slash-commands';

/**
 * Exercises the `rich-text-editor/slash-commands` addon end-to-end in a real
 * consumer install: the base editor ships no slash-command code; the addon
 * contributes the `/` menu through `RichTextEditorAddonHost`, driving the base
 * block-transform engine and insert seams. A second editor without the addon
 * proves typing `/` opens nothing there.
 */
@Component({
    selector: 'app-rte-slash-commands-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, RichTextEditorComponent, RichTextSlashCommandsDirective],
    template: `
        <main class="p-8 space-y-6">
            <section>
                <h2 class="mb-2 font-semibold">Editor with slash-commands addon</h2>
                <ui-rich-text-editor
                    data-testid="editor"
                    mode="html"
                    [uiRteSlashCommands]="commands"
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
export class RteSlashCommandsDemoComponent {
    protected readonly content = signal('<p>Try commands here: </p>');
    protected readonly plainContent = signal('<p>Plain editor, no addon: </p>');
    protected readonly commands: RichTextSlashCommand[] = [
        {
            id: 'custom.stamp',
            label: 'Insert Stamp',
            description: 'Inserts a fixed marker',
            keywords: ['stamp', 'marker'],
            order: 200,
            run: (ctx) => ctx.insertText('STAMPED'),
        },
    ];
}
