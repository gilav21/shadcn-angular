import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RichTextViewComponent } from '@/components/ui/rich-text-view';

/**
 * `ui-rich-text-view` in a pristine consumer install — `add rich-text-view`
 * pulls the editor base for the sanitizer and markdown services, but this page
 * imports only the view. It proves the render-only path: hostile HTML is
 * stripped by the library sanitizer (not Angular's), markdown parses, and the
 * shared typography actually reaches the DOM as computed style.
 */
@Component({
    selector: 'app-rich-text-view-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RichTextViewComponent],
    template: `
        <main class="p-8 space-y-6">
            <section>
                <h2 class="mb-2 font-semibold">HTML mode</h2>
                <ui-rich-text-view data-testid="view-html" mode="html" [value]="html()" />
            </section>

            <section>
                <h2 class="mb-2 font-semibold">Markdown mode</h2>
                <ui-rich-text-view data-testid="view-md" [value]="markdown()" />
            </section>
        </main>
    `,
})
export class RichTextViewDemoComponent {
    protected readonly html = signal(
        '<h1>Title</h1><p>Body</p><script>window.pwned = true</script>',
    );
    protected readonly markdown = signal('# Md\n\nSome **bold**');
}
