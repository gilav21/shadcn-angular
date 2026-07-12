import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { ChangeDetectionStrategy, Component, computed, effect, inject, Injector, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { RichTextEditorComponent } from '../../rich-text-editor.component';
import { RichTextActionsDirective } from './rich-text-actions.directive';
import { RichTextActionsBindDirective } from './rich-text-actions-bind.directive';
import { hoverCardAction, hoverCardHandlers } from './presets/hover-card.preset';
import { openDialogAction, openDialogHandlers } from './presets/open-dialog.preset';
import { linkedPreviewDialogAction, linkedPreviewDialogHandlers } from './presets/linked-preview-dialog.preset';
import type { RichTextActionDefinition } from './rich-text-actions.types';
import type { RichTextActionEvent } from './actions-runtime';

type StoryVariant = 'tier1' | 'presets' | 'styled' | 'combined';

const STARTER_STYLE: Record<string, string> = {
    color: '#2563eb', textDecoration: 'underline dotted', textUnderlineOffset: '3px',
};

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

// The action span carries the inline style a fresh attach seeds from STARTER_STYLE
// (uiRteActionsStyle only applies on a new attach), so the starter look is visible on load.
const STYLED_SEED = 'color:#2563eb;text-decoration:underline dotted;text-underline-offset:3px';
const STYLED_CONTENT =
    '<p>The starter style paints newly-attached actions blue with a dotted underline — see our ' +
    `<span style="${STYLED_SEED}" data-action-click="open-dialog" ` +
    'data-action-click-params=\'{"dialogId":"pricing"}\'>pricing</span> ' +
    'page.</p>';

const COMBINED_PARAMS = '{"title":"Idempotent","body":"Calling it once or many times has the same effect."}';
const COMBINED_CONTENT =
    '<p>Hover or click <span data-action-hover="preset.linked-preview-dialog" ' +
    `data-action-hover-params='${COMBINED_PARAMS}' ` +
    'data-action-click="preset.linked-preview-dialog" ' +
    `data-action-click-params='${COMBINED_PARAMS}'>idempotent</span> — hover shows a preview, click opens the ` +
    'full dialog.</p>';

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
                    [uiRteActionsStyle]="starterStyle()"
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

    protected readonly defs = computed<RichTextActionDefinition[]>(() => {
        switch (this.variant()) {
            case 'presets': return [hoverCardAction(), openDialogAction()];
            case 'combined': return [linkedPreviewDialogAction()];
            default: return [TIER1_ACTION];
        }
    });

    // Only the `styled` story seeds a non-default starter style; other stories
    // leave the addon's built-in default (an underline) untouched.
    protected readonly starterStyle = computed<Record<string, string>>(() =>
        this.variant() === 'styled' ? STARTER_STYLE : {});

    // The rich-text editor sanitizes its own HTML output; we render that trusted
    // result so the inert `data-action-*` attributes survive Angular's binding.
    // eslint-disable-next-line sonarjs/no-angular-bypass-sanitization
    protected readonly trusted = computed<SafeHtml>(() => this.sanitizer.bypassSecurityTrustHtml(this.content()));

    // Handler ids never collide (open-dialog vs preset.*), so all can coexist.
    protected readonly handlers: Record<string, (e: RichTextActionEvent) => void> = {
        'open-dialog': (e: RichTextActionEvent) => this.lastFired.set(`open-dialog(${e.params['dialogId']})`),
        ...hoverCardHandlers(this.injector),
        ...openDialogHandlers(this.injector),
        ...linkedPreviewDialogHandlers(this.injector),
    };

    constructor() {
        effect(() => this.content.set(this.contentFor(this.variant())));
    }

    private contentFor(variant: StoryVariant): string {
        switch (variant) {
            case 'presets': return PRESETS_CONTENT;
            case 'styled': return STYLED_CONTENT;
            case 'combined': return COMBINED_CONTENT;
            default: return TIER1_CONTENT;
        }
    }
}

const meta: Meta<RteActionsStory> = {
    title: 'Editor/Rich Text Actions',
    component: RteActionsStory,
    decorators: [moduleMetadata({ imports: [RteActionsStory] })],
    argTypes: {
        variant: {
            control: 'select',
            options: ['tier1', 'presets', 'styled', 'combined'],
            description: 'Which action configuration the playground seeds: Tier-1 declarative fields, batteries-included presets, starter-styled, or a combined hover+click action.',
        },
        readonly: {
            control: 'boolean',
            description: 'Renders the editor read-only, hiding the authoring entry points for actions.',
        },
        rtl: {
            control: 'boolean',
            description: 'Switches the layout and addon locale to RTL (Hebrew).',
        },
    },
    args: {
        variant: 'tier1',
        readonly: false,
        rtl: false,
    },
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

/** `uiRteActionsStyle` seeds a global starter style (blue, dotted underline) on newly-attached actions. */
export const StarterStyling: Story = { args: { variant: 'styled' } };

/** `linkedPreviewDialogAction()` — one action definition, hover previews and click opens the full dialog. */
export const CombinedAction: Story = { args: { variant: 'combined' } };
