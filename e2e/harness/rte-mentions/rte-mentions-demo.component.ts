import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RichTextEditorComponent } from '@/components/ui/rich-text-editor';
import {
    RichTextMentionsDirective,
    type MentionItem,
} from '@/components/ui/rich-text-editor/addons/mentions';

/**
 * Exercises the `rich-text-editor/mentions` addon end-to-end in a real consumer
 * install: the base editor ships no @/# UI; the addon detects the trigger at the
 * caret through the `registerInputObserver` seam, renders the candidate popover,
 * and inserts the entity chip through the `mutateContent` host seam. That the
 * harness compiles at all proves the addon builds under AOT in a plain consumer
 * app (no workspace dedup) with its own `scroll-area` dependency.
 */
@Component({
    selector: 'app-rte-mentions-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, RichTextEditorComponent, RichTextMentionsDirective],
    template: `
        <main class="p-8 space-y-6">
            <section>
                <h2 class="mb-2 font-semibold">Editor with mentions addon</h2>
                <ui-rich-text-editor
                    data-testid="editor"
                    mode="html"
                    uiRteMentions
                    [uiRteMentionsSearch]="search"
                    (mentionInsert)="lastInsert.set($event.label)"
                    [ngModel]="content()"
                    (ngModelChange)="content.set($event)"
                />
                <pre data-testid="editor-html" class="sr-only">{{ content() }}</pre>
                <pre data-testid="last-insert" class="sr-only">{{ lastInsert() }}</pre>
            </section>

            <section>
                <h2 class="mb-2 font-semibold">Editor without the addon</h2>
                <ui-rich-text-editor data-testid="editor-plain" mode="html" />
            </section>
        </main>
    `,
})
export class RteMentionsDemoComponent {
    protected readonly content = signal('');
    protected readonly lastInsert = signal('');

    private readonly users: MentionItem[] = [
        { id: 'u1', value: 'john-doe', label: 'John Doe', description: 'Engineering' },
        { id: 'u2', value: 'jane-smith', label: 'Jane Smith', description: 'Design' },
    ];

    protected readonly search = (query: string): MentionItem[] => {
        const q = query.trim().toLowerCase();
        return this.users.filter((u) => u.label.toLowerCase().includes(q));
    };
}
