import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RichTextEditorComponent } from '@/components/ui/rich-text-editor';
import { RichTextOutlineDirective } from '@/components/ui/rich-text-editor/addons/outline';

/**
 * Exercises the `rich-text-editor/outline` addon end-to-end in a real consumer
 * install: the base editor ships no outline UI and no `scroll-area` dependency;
 * the addon contributes the outline toolbar button + a docked table-of-contents
 * panel through `RichTextEditorAddonHost` (toolbar slot + overlay anchor). That
 * the harness compiles at all proves the addon builds under AOT in a plain
 * consumer app (no workspace dedup) with its own scroll-area dependency.
 */
@Component({
    selector: 'app-rte-outline-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, RichTextEditorComponent, RichTextOutlineDirective],
    template: `
        <main class="p-8 space-y-6">
            <section>
                <h2 class="mb-2 font-semibold">Editor with outline addon</h2>
                <ui-rich-text-editor
                    data-testid="editor"
                    mode="html"
                    uiRteOutline
                    [ngModel]="content()"
                    (ngModelChange)="content.set($event)"
                />
            </section>

            <section>
                <h2 class="mb-2 font-semibold">Editor without the addon</h2>
                <ui-rich-text-editor data-testid="editor-plain" mode="html" [ngModel]="content()" />
            </section>
        </main>
    `,
})
export class RteOutlineDemoComponent {
    protected readonly content = signal(
        '<h1>Getting started</h1><p>Overview.</p>' +
        '<h2>Installation</h2><p>Add it.</p>' +
        '<h3>Prerequisites</h3><p>Node.</p>' +
        '<h2>Usage</h2><p>Type away.</p>',
    );
}
