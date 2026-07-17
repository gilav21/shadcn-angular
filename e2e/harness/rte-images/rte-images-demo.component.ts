import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RichTextEditorComponent } from '@/components/ui/rich-text-editor';
import { RichTextImagesDirective } from '@/components/ui/rich-text-editor/addons/images';

/**
 * Exercises the `rich-text-editor/images` addon end-to-end in a real consumer
 * install: the base editor ships no image UI; the addon contributes the image
 * toolbar button + insert popover as a component slot through
 * `RichTextEditorAddonHost`, inserts through the `mutateContent` host seam, and
 * mounts the resize/align overlay in the host's positioned container. That the
 * harness compiles at all proves the addon builds under AOT in a plain consumer
 * app (no workspace dedup) with its own `button` + `popover` dependencies.
 */
@Component({
    selector: 'app-rte-images-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, RichTextEditorComponent, RichTextImagesDirective],
    template: `
        <main class="p-8 space-y-6">
            <section>
                <h2 class="mb-2 font-semibold">Editor with images addon</h2>
                <ui-rich-text-editor
                    data-testid="editor"
                    mode="html"
                    uiRteImages
                    (imageUploadComplete)="lastUpload.set($event)"
                    [ngModel]="content()"
                    (ngModelChange)="content.set($event)"
                />
                <pre data-testid="editor-html" class="sr-only">{{ content() }}</pre>
                <pre data-testid="last-upload" class="sr-only">{{ lastUpload() }}</pre>
            </section>

            <section>
                <h2 class="mb-2 font-semibold">Editor without the addon</h2>
                <ui-rich-text-editor data-testid="editor-plain" mode="html" />
            </section>
        </main>
    `,
})
export class RteImagesDemoComponent {
    protected readonly content = signal('<p>Place the caret here, then insert an image.</p>');
    protected readonly lastUpload = signal('');
}
