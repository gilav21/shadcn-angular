import { ChangeDetectionStrategy, Component, computed, inject, Injector, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { RichTextEditorComponent } from '../../../../../packages/components/ui';
import {
    RichTextActionsDirective,
    RichTextActionsBindDirective,
    hoverCardHandlers,
    openDialogHandlers,
    type RichTextActionDefinition,
    type RichTextActionEvent,
} from '../../../../../packages/components/ui/rich-text-editor/addons/actions';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { RICH_TEXT_ACTIONS_DEMO_LOCALES } from './rich-text-actions-demo.locales';

const TIER1_ACTION: RichTextActionDefinition = {
    id: 'open-dialog', label: 'Open dialog', icon: 'app-window', triggers: ['click'],
    fields: [{ key: 'dialogId', label: 'Dialog', type: 'text', required: true }],
};

const TIER1_CONTENT =
    '<p>See our <span data-action-click="open-dialog" ' +
    'data-action-click-params=\'{"dialogId":"pricing"}\'>pricing</span> page.</p>';

const PRESETS_CONTENT =
    '<p>Hover <span data-action-hover="preset.hover-card" ' +
    'data-action-hover-params=\'{"title":"Tip","body":"A helpful hover card."}\'>this term</span> ' +
    'or click <span data-action-click="preset.open-dialog" ' +
    'data-action-click-params=\'{"title":"Pricing","body":"Our plans start at $9/mo."}\'>here</span>.</p>';

@Component({
    selector: 'app-rich-text-actions-demo',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, RichTextEditorComponent, RichTextActionsDirective, RichTextActionsBindDirective],
    template: `
        <section class="space-y-8">
            <div class="space-y-2">
                <h2 id="rich-text-actions" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
                <p class="text-muted-foreground">{{ t().description }}</p>
            </div>

            <div class="grid gap-6 md:grid-cols-2">
                <div class="space-y-2">
                    <h3 class="text-lg font-medium">{{ t().editorHeading }}</h3>
                    <p class="text-sm text-muted-foreground">{{ t().editorHint }}</p>
                    <ui-rich-text-editor
                        mode="html" toolbar="top" minHeight="140px"
                        [uiRteActions]="tier1Defs"
                        [ngModel]="tier1Content()" (ngModelChange)="tier1Content.set($event)"
                    />
                </div>
                <div class="space-y-2">
                    <h3 class="text-lg font-medium">{{ t().publishedHeading }}</h3>
                    <p class="text-sm text-muted-foreground">{{ t().publishedHint }}</p>
                    <article
                        class="rounded-lg border p-4"
                        [innerHTML]="tier1Trusted()" [uiRichTextActions]="tier1Handlers"
                    ></article>
                    @if (lastFired()) {
                        <p class="text-xs text-muted-foreground">{{ t().lastFired }}: {{ lastFired() }}</p>
                    }
                </div>
            </div>

            <div class="space-y-2">
                <h3 class="text-lg font-medium">{{ t().presetsHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().presetsHint }}</p>
                <article
                    class="rounded-lg border p-4"
                    [innerHTML]="presetsTrusted" [uiRichTextActions]="presetHandlers"
                ></article>
            </div>
        </section>
    `,
})
export class RichTextActionsDemoComponent {
    private readonly localeId = inject(UI_LOCALE_ID);
    private readonly sanitizer = inject(DomSanitizer);
    private readonly injector = inject(Injector);

    protected readonly t = computed(() =>
        RICH_TEXT_ACTIONS_DEMO_LOCALES[this.localeId()] ?? RICH_TEXT_ACTIONS_DEMO_LOCALES['en']);

    protected readonly tier1Defs: RichTextActionDefinition[] = [TIER1_ACTION];
    protected readonly tier1Content = signal(TIER1_CONTENT);
    protected readonly lastFired = signal('');

    // The editor sanitizes its own HTML; we render that trusted output so the
    // inert data-action-* attributes survive Angular's binding sanitizer.
    protected readonly tier1Trusted = computed<SafeHtml>(() => this.trust(this.tier1Content()));

    protected readonly tier1Handlers: Record<string, (e: RichTextActionEvent) => void> = {
        'open-dialog': (e: RichTextActionEvent) => this.lastFired.set(`open-dialog(${e.params['dialogId']})`),
    };

    protected readonly presetsTrusted: SafeHtml = this.trust(PRESETS_CONTENT);
    protected readonly presetHandlers = {
        ...hoverCardHandlers(this.injector),
        ...openDialogHandlers(this.injector),
    };

    // Centralized trust boundary: the rich-text editor already sanitizes its
    // HTML output, so rendering it verbatim keeps the inert data-action-* hooks.
    private trust(html: string): SafeHtml {
        // eslint-disable-next-line sonarjs/no-angular-bypass-sanitization
        return this.sanitizer.bypassSecurityTrustHtml(html);
    }
}
