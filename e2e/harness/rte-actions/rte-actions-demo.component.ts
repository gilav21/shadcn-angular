import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { RichTextEditorComponent } from '@/components/ui/rich-text-editor';
import {
    RichTextActionsDirective,
    RichTextActionsBindDirective,
    type RichTextActionDefinition,
    type RichTextActionEvent,
} from '@/components/ui/rich-text-editor/addons/actions';
import {
    DialogComponent, DialogContentComponent, DialogHeaderComponent, DialogTitleComponent,
} from '@/components/ui/dialog';

/**
 * Exercises the `rich-text-editor/actions` addon end-to-end in a real consumer
 * install: the base editor gains an "Attach action" toolbar button via the
 * host slot registry, and the framework-free render runtime (`uiRichTextActions`)
 * fires the developer callback — opening a real `ui-dialog` — when the published
 * HTML is clicked. The base editor ships no action code.
 */
@Component({
    selector: 'app-rte-actions-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule, RichTextEditorComponent, RichTextActionsDirective, RichTextActionsBindDirective,
        DialogComponent, DialogContentComponent, DialogHeaderComponent, DialogTitleComponent,
    ],
    template: `
        <main class="p-8 space-y-6">
            <section>
                <h2 class="mb-2 font-semibold">Editor</h2>
                <ui-rich-text-editor
                    data-testid="editor"
                    mode="html"
                    [uiRteActions]="defs"
                    [(ngModel)]="content"
                />
            </section>

            <section>
                <h2 class="mb-2 font-semibold">Published page</h2>
                <article
                    data-testid="published"
                    [innerHTML]="publishedHtml"
                    [uiRichTextActions]="handlers"
                ></article>
            </section>

            <ui-dialog [open]="dialogOpen()" (openChange)="dialogOpen.set($event)">
                <ui-dialog-content data-testid="opened-dialog">
                    <ui-dialog-header>
                        <ui-dialog-title>Dialog: {{ openedDialogId() }}</ui-dialog-title>
                    </ui-dialog-header>
                </ui-dialog-content>
            </ui-dialog>
        </main>
    `,
})
export class RteActionsDemoComponent {
    private readonly sanitizer = inject(DomSanitizer);

    protected content = '<p>Edit me and attach an action.</p>';

    protected readonly defs: RichTextActionDefinition[] = [
        {
            id: 'open-dialog', label: 'Open dialog', triggers: ['click'],
            fields: [{ key: 'dialogId', label: 'Dialog', type: 'text', required: true }],
        },
    ];

    // Pre-seeded, already-sanitized editor output (e2e scaffolding); the inert
    // data-action-* hooks must survive Angular's binding sanitizer.
    // eslint-disable-next-line sonarjs/no-angular-bypass-sanitization
    protected readonly publishedHtml: SafeHtml = this.sanitizer.bypassSecurityTrustHtml(
        '<p>See our <span data-action-click="open-dialog" ' +
        'data-action-click-params=\'{"dialogId":"pricing"}\'>pricing</span> page.</p>',
    );

    protected readonly dialogOpen = signal(false);
    protected readonly openedDialogId = signal('');

    protected readonly handlers = {
        'open-dialog': (event: RichTextActionEvent): void => {
            this.openedDialogId.set(String(event.params['dialogId']));
            this.dialogOpen.set(true);
        },
    };
}
