import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { ButtonComponent } from '../../../../../packages/components/ui/button';
import {
    RichTextEditorComponent,
    richTextRequired,
    richTextMaxLength,
    richTextMinWords,
    type RichTextHistoryState,
} from '../../../../../packages/components/ui/rich-text-editor';
import { RTE_FULL } from '../../../../../packages/components/ui/rich-text-editor/addons/full';
import { RichTextViewComponent } from '../../../../../packages/components/ui/rich-text-view';

const PUBLISHED = '<h1>Published output</h1>'
    + '<p>This pane is <strong>not</strong> an editor — it is <code>ui-rich-text-view</code>, '
    + 'sharing the editor\'s sanitizer and typography.</p>'
    + '<ul><li>Read-only</li><li>Same prose classes</li></ul>';

/**
 * Temporary showcase for the four-wave rich-text effort. Every section maps to
 * a shipped change so it can be validated by hand in one place. Delete once
 * reviewed — the permanent demos live on the four `rich-text-*` routes.
 */
@Component({
    selector: 'app-wave-showcase-demo',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        ReactiveFormsModule,
        ButtonComponent,
        RichTextEditorComponent,
        RichTextViewComponent,
        ...RTE_FULL,
    ],
    templateUrl: './wave-showcase-demo.component.html',
})
export class WaveShowcaseDemoComponent {
    /** Wave 2 — markdown input rules and the block-state toolbar. */
    readonly markdownDoc = signal('');
    readonly shortcutsOn = signal(true);

    /** Wave 3 — find & replace, undo consistency, dirty state. */
    readonly findDoc = signal(
        '<p>The quick brown fox jumps over the lazy dog. '
        + 'The <strong>quick</strong> brown fox returns.</p>',
    );
    readonly history = signal<RichTextHistoryState>({ canUndo: false, canRedo: false });
    readonly externalWrites = signal(true);
    private readonly findEditor = viewChild<RichTextEditorComponent>('findEditor');

    /** Wave 4 — the imperative API. */
    readonly apiDoc = signal('<p>Select a word, then drive the editor from code.</p>');
    readonly apiLog = signal<string[]>([]);
    private readonly apiEditor = viewChild<RichTextEditorComponent>('apiEditor');

    /** Wave 4 — reactive-forms validators that measure visible text. */
    readonly notes = new FormControl('', [
        Validators.required,
        richTextRequired(),
        richTextMaxLength(120),
        richTextMinWords(3),
    ]);

    /** Wave 4 — the read-only renderer. */
    readonly published = PUBLISHED;

    /** Wave 1 — the disabled-state fix: `control.disable()` now reaches the editor. */
    readonly disabledDemo = new FormControl('<p>Toggle the button — a disabled form control now locks this editor.</p>');

    protected log(message: string): void {
        this.apiLog.update(entries => [message, ...entries].slice(0, 5));
    }

    protected callFocus(): void {
        this.apiEditor()?.focus();
        this.log('focus()');
    }

    protected callInsert(): void {
        this.apiEditor()?.insertText(' [inserted] ');
        this.log('insertText(" [inserted] ")');
    }

    protected callBold(): void {
        this.apiEditor()?.format('bold');
        this.log('format("bold")');
    }

    protected callUndo(): void {
        this.apiEditor()?.undo();
        this.log('undo()');
    }

    protected reportEmpty(): void {
        this.log(`isEmpty() → ${this.apiEditor()?.isEmpty()}`);
    }

    protected setContentTracked(): void {
        this.findEditor()?.setContent('<p>Replaced programmatically — this IS undoable.</p>');
    }

    protected markClean(): void {
        this.findEditor()?.markClean();
    }

    protected toggleDisabled(): void {
        if (this.disabledDemo.disabled) this.disabledDemo.enable();
        else this.disabledDemo.disable();
    }
}
