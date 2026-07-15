import {
    Directive,
    DestroyRef,
    Injector,
    ViewContainerRef,
    afterNextRender,
    computed,
    effect,
    inject,
    input,
    output,
    signal,
    type ComponentRef,
    type Type,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Subscription } from 'rxjs';
import { RichTextEditorAddonHost, RichTextSanitizerService } from '../..';
import { AiProvider, AiTask, runAiTask } from '../../../../lib/ai';
import { createLocaleBindings, type LocaleInput } from '../../../../lib/i18n';
import { RICH_TEXT_AI_LOCALES, type RichTextAiLocale } from './rich-text-ai.locales';
import {
    RICH_TEXT_AI_CONTEXT,
    type RichTextAiContext,
    type RichTextAiPhase,
    type RichTextAiPoint,
    type RichTextAiTaskOption,
} from './rich-text-ai.context';
import { RichTextAiChipComponent } from './rich-text-ai-chip.component';
import { RichTextAiPanelComponent } from './rich-text-ai-panel.component';

const CHIP_OFFSET_Y = 40;
const PANEL_OFFSET_Y = 8;
const PANEL_MIN_X = 8;

/**
 * Opt-in AI-assist addon for `<ui-rich-text-editor>`. Attaches via DI to the
 * `RichTextEditorAddonHost` the base provides and owns the whole "Ask AI"
 * feature: the floating chip on a text selection, the task menu + custom-prompt
 * panel, the streaming draft, and the accept / discard / try-again review — plus
 * the `/ai` slash command it registers into the editor's command registry. The
 * base editor ships no AI UI; providing an `[uiRteAi]` provider is what turns it
 * on (replacing the former `[aiProvider]` input).
 *
 * The provider contract is unchanged: it receives an {@link import('../../../../lib/ai').AiRequest}
 * and returns a string, Promise, or Observable that emits the full text so far
 * (streaming). The draft streams live into the editor DOM; Accept commits it as
 * one history entry through the host's `mutateContent`, Discard restores the
 * captured selection through `commitContent`.
 *
 * Strings resolve from `[uiRteAiLocale]` (a registry key or a full dictionary)
 * or the app-wide `UI_LOCALE_ID` token — NOT the editor's own `[locale]` input.
 *
 * ```html
 * <ui-rich-text-editor [uiRteAi]="aiProvider" />
 * ```
 */
@Directive({
    selector: 'ui-rich-text-editor[uiRteAi]',
    standalone: true,
})
export class RichTextAiDirective {
    private readonly host = inject(RichTextEditorAddonHost);
    private readonly sanitizer = inject(RichTextSanitizerService);
    private readonly injector = inject(Injector);
    private readonly vcr = inject(ViewContainerRef);
    private readonly document = inject(DOCUMENT);

    /** The bring-your-own AI provider. Its presence turns the feature on. */
    readonly uiRteAi = input<AiProvider | undefined>(undefined);
    /** Locale for the addon UI: a registry key (`'en'`/`'he'`/…) or a full dictionary. */
    readonly uiRteAiLocale = input<LocaleInput<RichTextAiLocale>>();
    /** Contribute the `/ai` slash command (default true). */
    readonly uiRteAiSlashCommand = input(true);

    /** Emitted when an AI task starts, carrying the task and optional prompt. */
    readonly aiRequest = output<{ task: AiTask; prompt?: string }>();
    /** Emitted with the final generated text when a task completes. */
    readonly aiResult = output<string>();
    /** Emitted with the message when a task errors. */
    readonly aiError = output<string>();

    private readonly i18n = createLocaleBindings(this.uiRteAiLocale, RICH_TEXT_AI_LOCALES);
    private readonly viewReady = signal(false);

    private readonly hasProvider = computed(() => typeof this.uiRteAi() === 'function');

    private readonly chipVisible = signal(false);
    private readonly chipPosition = signal<RichTextAiPoint>({ x: 0, y: 0 });
    private readonly panelOpen = signal(false);
    private readonly phase = signal<RichTextAiPhase>('menu');
    private readonly panelPosition = signal<RichTextAiPoint>({ x: 0, y: 0 });
    private readonly errorMessage = signal<string | null>(null);

    private readonly tasks = computed<readonly RichTextAiTaskOption[]>(() => {
        const l = this.i18n.t();
        return [
            { task: 'rewrite', label: l.rewrite },
            { task: 'fix-grammar', label: l.fixGrammar },
            { task: 'shorten', label: l.shorten },
            { task: 'expand', label: l.expand },
            { task: 'summarize', label: l.summarize },
            { task: 'continue', label: l.continueWriting },
        ];
    });

    private subscription: Subscription | null = null;
    private controller: AbortController | null = null;
    private draftEl: HTMLElement | null = null;
    private range: Range | null = null;
    private savedHtml = '';
    private savedText = '';
    private continueMode = false;
    private lastTask: AiTask = 'rewrite';
    private lastPrompt: string | undefined;

    private chipRef?: ComponentRef<RichTextAiChipComponent>;
    private panelRef?: ComponentRef<RichTextAiPanelComponent>;
    private readonly onSelectionChangeBound = (): void => this.updateChip();

    constructor() {
        afterNextRender(() => this.viewReady.set(true));
        this.registerSlashCommand();
        this.mountOverlays();
        this.registerSelectionListener();
        inject(DestroyRef).onDestroy(() => this.teardown());
    }

    // ── Slash command ─────────────────────────────────────────────────

    private registerSlashCommand(): void {
        effect((onCleanup) => {
            if (!this.uiRteAiSlashCommand() || !this.hasProvider()) return;
            const l = this.i18n.t();
            onCleanup(this.host.commands.registerCommand({
                id: 'insert.ai',
                label: l.slash,
                description: l.slashDescription,
                keywords: ['ai', 'assist', 'rewrite', 'summarize', 'generate'],
                order: 5,
                run: () => this.openPanel(),
            }));
        });
    }

    // ── Selection chip ────────────────────────────────────────────────

    private registerSelectionListener(): void {
        effect((onCleanup) => {
            if (!this.viewReady()) return;
            this.document.addEventListener('selectionchange', this.onSelectionChangeBound);
            onCleanup(() => this.document.removeEventListener('selectionchange', this.onSelectionChangeBound));
        });
    }

    private updateChip(): void {
        if (this.panelOpen()) return;
        const selection = this.document.getSelection();
        const active = this.isSelectionActive(selection);
        if (active && selection) {
            const rect = selection.getRangeAt(0).getBoundingClientRect();
            this.chipPosition.set({ x: rect.left, y: rect.top - CHIP_OFFSET_Y });
            this.chipVisible.set(true);
        } else {
            this.chipVisible.set(false);
        }
    }

    private isSelectionActive(selection: Selection | null): boolean {
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false;
        if (!this.hasProvider() || this.host.readonly() || this.host.disabled()) return false;
        return this.host.contentRoot.contains(selection.anchorNode);
    }

    // ── Panel lifecycle ───────────────────────────────────────────────

    /** Open the task menu, capturing the current selection (or caret for continue). */
    openPanel(): void {
        if (!this.hasProvider()) return;
        this.captureSelection();
        this.errorMessage.set(null);
        this.phase.set('menu');
        this.chipVisible.set(false);
        if (this.range) {
            const rect = this.range.getBoundingClientRect();
            this.panelPosition.set({ x: Math.max(PANEL_MIN_X, rect.left), y: rect.bottom + PANEL_OFFSET_Y });
        }
        this.panelOpen.set(true);
    }

    private captureSelection(): void {
        const selection = this.document.getSelection();
        if (!selection || selection.rangeCount === 0) {
            this.range = null;
            this.savedText = '';
            this.savedHtml = '';
            return;
        }
        const range = selection.getRangeAt(0);
        this.range = range.cloneRange();
        if (range.collapsed) {
            this.savedText = this.host.contentRoot.textContent ?? '';
            this.savedHtml = '';
        } else {
            this.savedText = selection.toString();
            const wrapper = this.document.createElement('div');
            wrapper.appendChild(range.cloneContents());
            this.savedHtml = wrapper.innerHTML;
        }
    }

    // ── Task execution ────────────────────────────────────────────────

    /** Run a built-in AI task on the captured selection. */
    runTask(task: AiTask, prompt?: string): void {
        if (!this.hasProvider() || !this.range) return;
        this.cancel();
        this.continueMode = task === 'continue';
        this.beginDraft();
        if (this.draftEl) this.stream(task, prompt);
    }

    /** Run the user's free-form prompt. */
    runCustom(prompt: string): void {
        const trimmed = prompt.trim();
        if (trimmed) this.runTask('custom', trimmed);
    }

    /** Re-run whichever task produced the current draft. */
    retryLast(): void {
        if (!this.draftEl) {
            this.runTask(this.lastTask, this.lastPrompt);
            return;
        }
        this.cancel();
        this.draftEl.textContent = '';
        this.stream(this.lastTask, this.lastPrompt);
    }

    private stream(task: AiTask, prompt?: string): void {
        const provider = this.uiRteAi();
        if (typeof provider !== 'function') return;
        this.lastTask = task;
        this.lastPrompt = prompt;
        this.aiRequest.emit({ task, prompt });
        this.errorMessage.set(null);
        this.phase.set('loading');
        this.controller = new AbortController();
        this.subscription = runAiTask(provider, {
            task,
            input: this.savedText,
            prompt,
            signal: this.controller.signal,
        }).subscribe({
            next: (text) => this.updateDraft(text),
            error: (err) => this.onStreamError(err),
            complete: () => this.onStreamComplete(),
        });
    }

    private onStreamError(err: unknown): void {
        const message = err instanceof Error ? err.message : this.i18n.t().failed;
        this.errorMessage.set(message);
        this.aiError.emit(message);
        this.phase.set('review');
    }

    private onStreamComplete(): void {
        this.aiResult.emit(this.draftEl?.textContent ?? '');
        this.phase.set('review');
    }

    private beginDraft(): void {
        const editor = this.host.contentRoot;
        const selection = this.document.getSelection();
        if (!editor || !selection || !this.range) return;
        editor.focus();
        selection.removeAllRanges();
        selection.addRange(this.range);
        const range = selection.getRangeAt(0);
        if (this.continueMode) {
            range.collapse(false);
        } else {
            range.deleteContents();
        }
        const span = this.document.createElement('span');
        span.dataset['aiDraft'] = '';
        span.className = 'rte-ai-draft bg-primary/10 rounded-sm';
        range.insertNode(span);
        this.draftEl = span;
    }

    private updateDraft(text: string): void {
        if (this.draftEl) this.draftEl.textContent = text;
    }

    // ── Review ────────────────────────────────────────────────────────

    /** Keep the generated text, unwrapping the draft marker as one history entry. */
    accept(): void {
        const span = this.draftEl;
        this.host.mutateContent(() => {
            if (!span?.parentNode) return;
            const parent = span.parentNode;
            while (span.firstChild) parent.insertBefore(span.firstChild, span);
            span.remove();
        });
        this.finish();
    }

    /** Drop the draft and restore the original selection. */
    discard(): void {
        this.cancel();
        const span = this.draftEl;
        if (span?.parentNode) {
            if (this.savedHtml) {
                const template = this.document.createElement('template');
                template.innerHTML = this.sanitizer.sanitize(this.savedHtml);
                span.parentNode.replaceChild(template.content.cloneNode(true), span);
            } else {
                span.remove();
            }
        }
        this.finish();
        this.host.commitContent();
    }

    private cancel(): void {
        this.subscription?.unsubscribe();
        this.subscription = null;
        this.controller?.abort();
        this.controller = null;
    }

    private finish(): void {
        this.cancel();
        this.draftEl = null;
        this.range = null;
        this.savedHtml = '';
        this.savedText = '';
        this.panelOpen.set(false);
        this.phase.set('menu');
    }

    // ── Overlay mounting ──────────────────────────────────────────────

    private mountOverlays(): void {
        effect(() => {
            if (!this.viewReady() || this.chipRef) return;
            const anchor = this.host.overlayAnchor;
            const contextInjector = Injector.create({
                providers: [{ provide: RICH_TEXT_AI_CONTEXT, useValue: this.buildContext() }],
                parent: this.injector,
            });
            this.chipRef = this.createOverlay(RichTextAiChipComponent, contextInjector);
            this.panelRef = this.createOverlay(RichTextAiPanelComponent, contextInjector);
            anchor.appendChild(this.chipRef.location.nativeElement);
            anchor.appendChild(this.panelRef.location.nativeElement);
        });
    }

    private createOverlay<T>(component: Type<T>, injector: Injector): ComponentRef<T> {
        return this.vcr.createComponent(component, { injector });
    }

    private buildContext(): RichTextAiContext {
        return {
            locale: computed(() => this.i18n.t()),
            tasks: this.tasks,
            chipVisible: this.chipVisible.asReadonly(),
            chipPosition: this.chipPosition.asReadonly(),
            panelOpen: this.panelOpen.asReadonly(),
            phase: this.phase.asReadonly(),
            panelPosition: this.panelPosition.asReadonly(),
            errorMessage: this.errorMessage.asReadonly(),
            openPanel: () => this.openPanel(),
            runTask: (task) => this.runTask(task),
            runCustom: (prompt) => this.runCustom(prompt),
            accept: () => this.accept(),
            discard: () => this.discard(),
            retryLast: () => this.retryLast(),
        };
    }

    private teardown(): void {
        this.cancel();
        this.chipRef?.destroy();
        this.chipRef = undefined;
        this.panelRef?.destroy();
        this.panelRef = undefined;
    }
}
