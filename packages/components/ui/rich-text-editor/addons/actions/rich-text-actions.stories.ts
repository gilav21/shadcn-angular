import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { ChangeDetectionStrategy, Component, computed, effect, inject, Injector, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { RichTextEditorComponent } from '../../rich-text-editor.component';
import { RichTextActionsDirective } from './rich-text-actions.directive';
import { RichTextActionsBindDirective } from './rich-text-actions-bind.directive';
import { hoverCardAction, hoverCardHandlers } from './presets/hover-card.preset';
import { openDialogAction, openDialogHandlers } from './presets/open-dialog.preset';
import type { RichTextActionDefinition } from './rich-text-actions.types';
import type { RichTextActionEvent } from './actions-runtime';

type StoryVariant = 'tier1' | 'presets';

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
    'data-action-click-params=\'{"title":"Pricing","body":"Our plans start at $9."}\'>here</span>.</p>';

/**
 * A self-contained playground: a `<ui-rich-text-editor>` with the actions addon
 * on the left, and a live "published page" on the right that renders the
 * editor's HTML through `[uiRichTextActions]`, firing the developer callbacks.
 */
@Component({
    selector: 'story-rte-actions',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, RichTextEditorComponent, RichTextActionsDirective, RichTextActionsBindDirective],
    template: `
        <div class="grid gap-6 md:grid-cols-2" [attr.dir]="rtl() ? 'rtl' : null">
            <section>
                <h3 class="mb-2 text-sm font-semibold text-muted-foreground">Editor</h3>
                <ui-rich-text-editor
                    mode="html"
                    [readonly]="readonly()"
                    [uiRteActions]="defs()"
                    [uiRteActionsLocale]="rtl() ? 'he' : 'en'"
                    [ngModel]="content()"
                    (ngModelChange)="content.set($event)"
                />
            </section>
            <section>
                <h3 class="mb-2 text-sm font-semibold text-muted-foreground">Published page</h3>
                <article
                    class="prose prose-sm max-w-none rounded-lg border p-4"
                    [innerHTML]="trusted()"
                    [uiRichTextActions]="handlers"
                ></article>
                @if (lastFired()) {
                    <p class="mt-2 text-xs text-muted-foreground">Last fired: {{ lastFired() }}</p>
                }
            </section>
        </div>
    `,
})
class RteActionsStory {
    private readonly sanitizer = inject(DomSanitizer);
    private readonly injector = inject(Injector);

    readonly variant = input<StoryVariant>('tier1');
    readonly readonly = input(false);
    readonly rtl = input(false);

    protected readonly lastFired = signal('');
    protected readonly content = signal(TIER1_CONTENT);

    protected readonly defs = computed<RichTextActionDefinition[]>(() =>
        this.variant() === 'presets' ? [hoverCardAction(), openDialogAction()] : [TIER1_ACTION]);

    // The rich-text editor sanitizes its own HTML output; we render that trusted
    // result so the inert `data-action-*` attributes survive Angular's binding.
    // eslint-disable-next-line sonarjs/no-angular-bypass-sanitization
    protected readonly trusted = computed<SafeHtml>(() => this.sanitizer.bypassSecurityTrustHtml(this.content()));

    // Handler ids never collide (open-dialog vs preset.*), so all can coexist.
    protected readonly handlers: Record<string, (e: RichTextActionEvent) => void> = {
        'open-dialog': (e: RichTextActionEvent) => this.lastFired.set(`open-dialog(${e.params['dialogId']})`),
        ...hoverCardHandlers(this.injector),
        ...openDialogHandlers(this.injector),
    };

    constructor() {
        effect(() => this.content.set(this.variant() === 'presets' ? PRESETS_CONTENT : TIER1_CONTENT));
    }
}

const meta: Meta<RteActionsStory> = {
    title: 'Editor/Rich Text Actions',
    component: RteActionsStory,
    decorators: [moduleMetadata({ imports: [RteActionsStory] })],
};
export default meta;
type Story = StoryObj<RteActionsStory>;

/** Tier-1 declarative fields: attach an "Open dialog" action, click it on the right. */
export const Default: Story = { args: { variant: 'tier1' } };

/** Batteries-included presets: hover card + dialog wired in a few lines. */
export const Presets: Story = { args: { variant: 'presets' } };

/** Read-only editor: authoring entry points are hidden. */
export const Readonly: Story = { args: { variant: 'tier1', readonly: true } };

/** RTL locale (Hebrew) across the dialog and popover. */
export const RTL: Story = { args: { variant: 'tier1', rtl: true } };
