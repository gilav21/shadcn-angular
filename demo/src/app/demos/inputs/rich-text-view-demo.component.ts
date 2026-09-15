import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { ButtonComponent } from '../../../../../packages/components/ui/button';
import {
    RichTextEditorComponent,
    type EditorMode,
} from '../../../../../packages/components/ui/rich-text-editor';
import {
    RichTextActionsBindDirective,
    type RichTextActionEvent,
} from '../../../../../packages/components/ui/rich-text-editor/addons/actions';
import { RichTextViewComponent } from '../../../../../packages/components/ui/rich-text-view';
import { RICH_TEXT_VIEW_DEMO_LOCALES } from './rich-text-view-demo.locales';

const HTML_SEED = '<h1>Release notes</h1><p>We shipped <strong>a read-only renderer</strong>.</p>'
    + '<ul><li>Same sanitizer</li><li>Same typography</li></ul>';

const MARKDOWN_SEED = '# Release notes\n\nWe shipped **a read-only renderer**.\n\n'
    + '- Same sanitizer\n- Same typography';

const POLICY_SEED = '# Newsletter\n\n'
    + '![Logo](https://cdn.trusted.com/logo.png)\n\n'
    + 'Thanks for reading.\n\n'
    + '![](https://pixel.tracker.example/open?id=42)';

const RTL_SEED = '# שחרור גרסה\n\nהוספנו **מציג לקריאה בלבד**.';

@Component({
    selector: 'app-rich-text-view-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        ButtonComponent,
        RichTextEditorComponent,
        RichTextViewComponent,
        RichTextActionsBindDirective,
    ],
    template: `
    <div class="space-y-8 p-4 sm:p-6">
      <div class="space-y-2">
        <h2 class="text-2xl font-bold">{{ t().heading }}</h2>
        <p class="text-sm text-muted-foreground max-w-3xl">{{ t().description }}</p>
      </div>

      <section class="space-y-3">
        <h3 class="text-lg font-medium">{{ t().authorHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().authorDescription }}</p>

        <div class="flex flex-wrap items-center gap-2">
          <ui-button size="sm" [variant]="mode() === 'html' ? 'default' : 'outline'"
            (click)="setMode('html')">{{ t().modeHtml }}</ui-button>
          <ui-button size="sm" [variant]="mode() === 'markdown' ? 'default' : 'outline'"
            (click)="setMode('markdown')">{{ t().modeMarkdown }}</ui-button>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-2">
            <p class="text-xs font-medium uppercase text-muted-foreground">{{ t().editorLabel }}</p>
            <ui-rich-text-editor [mode]="mode()" [(ngModel)]="doc" minHeight="200px" />
          </div>
          <div class="space-y-2">
            <p class="text-xs font-medium uppercase text-muted-foreground">{{ t().viewLabel }}</p>
            <div class="rounded-md border p-3">
              <ui-rich-text-view [mode]="mode()" [value]="doc()" />
            </div>
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <h3 class="text-lg font-medium">{{ t().publishHeading }}</h3>
        <p class="text-sm text-muted-foreground max-w-3xl">{{ t().publishDescription }}</p>

        <div class="rounded-md border p-3">
          <ui-rich-text-view mode="html" [value]="t().publishedPost"
            [uiRichTextActions]="handlers" />
        </div>

        @if (fired(); as event) {
          <output class="block rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
            <span class="font-medium">{{ t().dialogTitle }}</span>
            — {{ t().dialogBody }}
            <code class="ms-1">{{ event.actionId }}</code>
            <ui-button class="ms-2" size="sm" variant="outline"
              (click)="fired.set(null)">{{ t().closeLabel }}</ui-button>
          </output>
        }
      </section>

      <section class="space-y-3">
        <h3 class="text-lg font-medium">{{ t().policyHeading }}</h3>
        <p class="text-sm text-muted-foreground max-w-3xl">{{ t().policyDescription }}</p>

        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-2">
            <p class="text-xs font-medium uppercase text-muted-foreground">
              {{ t().policyNoneLabel }}
            </p>
            <div class="rounded-md border p-3">
              <ui-rich-text-view [value]="policyDoc" />
            </div>
          </div>
          <div class="space-y-2">
            <p class="text-xs font-medium uppercase text-muted-foreground">
              {{ t().policySetLabel }}
            </p>
            <div class="rounded-md border p-3">
              <ui-rich-text-view [value]="policyDoc" [allowedImageHosts]="policyHosts" />
            </div>
          </div>
        </div>

        <p class="text-sm text-muted-foreground max-w-3xl">{{ t().policyNote }}</p>
      </section>

      <section class="space-y-3">
        <h3 class="text-lg font-medium">{{ t().sizesHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().sizesDescription }}</p>
        <div class="grid gap-4 md:grid-cols-3">
          <div class="rounded-md border p-3"><ui-rich-text-view size="sm" [value]="markdown" /></div>
          <div class="rounded-md border p-3"><ui-rich-text-view size="lg" [value]="markdown" /></div>
          <div class="rounded-md border p-3"><ui-rich-text-view dir="rtl" [value]="rtl" /></div>
        </div>
      </section>

      <section class="space-y-3">
        <h3 class="text-lg font-medium">{{ t().snippetsHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().snippetsDescription }}</p>
        <pre class="overflow-x-auto rounded-md border bg-muted p-3 text-xs"><code>{{ snippet }}</code></pre>
      </section>
    </div>
  `,
})
export class RichTextViewDemoComponent {
    private readonly localeId = inject(UI_LOCALE_ID);

    protected readonly t = computed(() =>
        RICH_TEXT_VIEW_DEMO_LOCALES[this.localeId()] ?? RICH_TEXT_VIEW_DEMO_LOCALES['en']);

    protected readonly mode = signal<EditorMode>('html');
    protected readonly doc = signal(HTML_SEED);

    /** The same document rendered twice, with and without a policy. */
    protected readonly policyDoc = POLICY_SEED;
    protected readonly policyHosts: readonly string[] = ['cdn.trusted.com'];
    protected readonly markdown = MARKDOWN_SEED;
    protected readonly rtl = RTL_SEED;

    /** The last action the published view delivered, or null. */
    protected readonly fired = signal<RichTextActionEvent | null>(null);

    protected readonly handlers = {
        'open-pricing': (event: RichTextActionEvent) => this.fired.set(event),
    };

    protected readonly snippet = [
        '<!-- Render what the editor produced -->',
        '<ui-rich-text-view mode="html" [value]="post.html" />',
        '',
        '<!-- Markdown is the default -->',
        '<ui-rich-text-view [value]="readme" />',
        '',
        '<!-- Published content with actions, no editor on the page -->',
        '<ui-rich-text-view mode="html" [value]="post.html"',
        '  [uiRichTextActions]="{ \'open-pricing\': openPricing }" />',
    ].join('\n');

    /** Switch both the editor and the view, seeding the model for the new syntax. */
    protected setMode(mode: EditorMode): void {
        this.mode.set(mode);
        this.doc.set(mode === 'html' ? HTML_SEED : MARKDOWN_SEED);
    }
}
