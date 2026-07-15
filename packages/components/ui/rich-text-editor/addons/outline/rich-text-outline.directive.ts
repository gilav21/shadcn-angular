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
    signal,
    type ComponentRef,
} from '@angular/core';
import { RichTextEditorAddonHost } from '../..';
import { createLocaleBindings, type LocaleInput } from '../../../../lib/i18n';
import { RichTextOutlinePanelComponent } from './rich-text-outline-panel.component';
import {
    RICH_TEXT_OUTLINE_CONTEXT,
    type OutlineHeading,
    type RichTextOutlineContext,
} from './rich-text-outline.context';
import {
    RICH_TEXT_OUTLINE_LOCALES,
    type RichTextOutlineLocale,
} from './rich-text-outline.locales';

const OUTLINE_SLOT_ID = 'view.outline';
const OUTLINE_COMMAND_ID = 'view.outline';
/** CSS selector matching every heading element used by the outline. */
const OUTLINE_HEADING_SELECTOR = 'h1,h2,h3,h4,h5,h6';
/** Gap (px) left above a heading when the outline scrolls it into view. */
const OUTLINE_SCROLL_MARGIN = 12;
/** Utility classes that inset the editable area past the docked panel (md+ only). */
const OUTLINE_INSET_CLASSES = [
    'transition-[padding]',
    'duration-150',
    'md:ps-[calc(16rem+8px)]',
    'lg:ps-[calc(20rem+8px)]',
];
/** Toolbar button glyph (matches the former built-in `outline` toolbar item). */
const OUTLINE_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 6H3"/><path d="M15 12H3"/><path d="M17 18H3"/><path d="M21 12h.01"/><path d="M21 18h.01"/></svg>';

/** Coerce the bare `uiRteOutline` attribute (empty string) to `true`. */
function coerceEnabled(value: boolean | string | undefined): boolean {
    return value === '' || value === true || value === undefined;
}

/** Maps a heading element to an {@link OutlineHeading} entry. */
function toOutlineHeading(element: Element, index: number): OutlineHeading {
    const level = Number.parseInt(element.tagName.charAt(1), 10);
    return {
        level,
        text: (element.textContent ?? '').trim(),
        index,
    };
}

/**
 * Opt-in document-outline addon for `<ui-rich-text-editor>`. Attaches via DI to
 * the `RichTextEditorAddonHost` the base provides and owns the whole outline
 * feature: the toolbar button that toggles a docked table-of-contents panel, the
 * `/outline` slash command, and the panel itself (headings in document order,
 * click / Enter / Space to scroll the editor to a heading). The base editor
 * ships no outline UI and no `scroll-area` dependency.
 *
 * The panel is read-only — it never mutates content. It refreshes its heading
 * list from a `MutationObserver` on the editor's content root while open, so it
 * tracks typing, paste, undo/redo, and programmatic edits alike. While open it
 * insets the editable area (md+ viewports) so the text sits beside the panel
 * rather than under it; on phones the panel overlays the content.
 *
 * Strings resolve from `[uiRteOutlineLocale]` (a registry key or a full
 * dictionary) or the app-wide `UI_LOCALE_ID` token — NOT the editor's own
 * `[locale]` input.
 *
 * ```html
 * <ui-rich-text-editor uiRteOutline />
 * ```
 */
@Directive({
    selector: 'ui-rich-text-editor[uiRteOutline], ui-rich-text-editor[uiRteFull]',
    standalone: true,
})
export class RichTextOutlineDirective {
    private readonly host = inject(RichTextEditorAddonHost);
    private readonly injector = inject(Injector);
    private readonly vcr = inject(ViewContainerRef);

    /** Locale for the addon UI: a registry key (`'en'`/`'he'`/…) or a full dictionary. */
    readonly uiRteOutlineLocale = input<LocaleInput<RichTextOutlineLocale>>();
    /** Enable the outline addon (the bare `uiRteOutline` attribute). Flip to `false` to remove the button, command, and panel live. */
    readonly uiRteOutline = input(true, { transform: coerceEnabled });
    /** Show the outline toolbar button (default true). Toggles the docked panel. */
    readonly uiRteOutlineButton = input(true);
    /** Sort order of the outline button among addon toolbar slots; lower first. */
    readonly uiRteOutlineOrder = input(900);
    /** Contribute the `/outline` slash command (default true). */
    readonly uiRteOutlineSlashCommand = input(true);

    private readonly i18n = createLocaleBindings(this.uiRteOutlineLocale, RICH_TEXT_OUTLINE_LOCALES);
    private readonly viewReady = signal(false);
    private readonly panelOpen = signal(false);
    private readonly refreshTick = signal(0);

    private readonly headings = computed<readonly OutlineHeading[]>(() => {
        this.refreshTick();
        if (!this.viewReady()) return [];
        const root = this.host.contentRoot;
        if (!root) return [];
        return Array.from(root.querySelectorAll(OUTLINE_HEADING_SELECTOR)).map(
            (element, index) => toOutlineHeading(element, index),
        );
    });

    private observer: MutationObserver | null = null;
    private panelRef?: ComponentRef<RichTextOutlinePanelComponent>;

    constructor() {
        afterNextRender(() => this.viewReady.set(true));
        this.registerToolbarButton();
        this.registerSlashCommand();
        this.mountPanel();
        this.trackContentWhileOpen();
        this.insetEditableWhileOpen();
        inject(DestroyRef).onDestroy(() => this.teardown());
    }

    // ── Toolbar button ────────────────────────────────────────────────

    private registerToolbarButton(): void {
        effect((onCleanup) => {
            if (!this.uiRteOutline() || !this.uiRteOutlineButton()) return;
            const tooltip = this.i18n.t().toolbar;
            onCleanup(this.host.toolbarSlots.register({
                id: OUTLINE_SLOT_ID,
                order: this.uiRteOutlineOrder(),
                icon: OUTLINE_ICON,
                tooltip,
                isActive: () => this.panelOpen(),
                onClick: () => this.togglePanel(),
            }));
        });
    }

    // ── Slash command ─────────────────────────────────────────────────

    private registerSlashCommand(): void {
        effect((onCleanup) => {
            if (!this.uiRteOutline() || !this.uiRteOutlineSlashCommand()) return;
            const l = this.i18n.t();
            onCleanup(this.host.commands.registerCommand({
                id: OUTLINE_COMMAND_ID,
                label: l.slash,
                description: l.slashDescription,
                keywords: ['outline', 'toc', 'headings', 'contents'],
                order: 125,
                run: () => this.openPanel(),
            }));
        });
    }

    // ── Panel state ───────────────────────────────────────────────────

    private togglePanel(): void {
        this.panelOpen.update((open) => !open);
    }

    private openPanel(): void {
        this.panelOpen.set(true);
    }

    /**
     * Smoothly scroll the heading at `index` to the top of the editor's own
     * scroll container. Never calls `Element.scrollIntoView()`, so it cannot
     * scroll the page or any ancestor — only the editor moves.
     */
    private scrollHeadingIntoView(index: number): void {
        const root = this.host.contentRoot;
        if (!root) return;
        const target = root.querySelectorAll<HTMLElement>(OUTLINE_HEADING_SELECTOR)[index];
        if (!target) return;
        const delta = target.getBoundingClientRect().top - root.getBoundingClientRect().top;
        root.scrollBy({ top: delta - OUTLINE_SCROLL_MARGIN, behavior: 'smooth' });
    }

    private onEntryKeydown(event: KeyboardEvent, index: number): void {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.scrollHeadingIntoView(index);
        }
    }

    // ── Content tracking (read-only) ──────────────────────────────────

    private trackContentWhileOpen(): void {
        effect((onCleanup) => {
            if (!this.viewReady() || !this.uiRteOutline() || !this.panelOpen()) return;
            const root = this.host.contentRoot;
            if (!root) return;
            this.refreshTick.update((tick) => tick + 1);
            const observer = new MutationObserver(() => this.refreshTick.update((tick) => tick + 1));
            observer.observe(root, { childList: true, subtree: true, characterData: true });
            this.observer = observer;
            onCleanup(() => {
                observer.disconnect();
                this.observer = null;
            });
        });
    }

    // ── Editable inset while open ─────────────────────────────────────

    private insetEditableWhileOpen(): void {
        effect(() => {
            if (!this.viewReady()) return;
            const root = this.host.contentRoot;
            if (!root) return;
            const open = this.uiRteOutline() && this.panelOpen();
            for (const cls of OUTLINE_INSET_CLASSES) {
                root.classList.toggle(cls, open);
            }
        });
    }

    // ── Panel mounting ────────────────────────────────────────────────

    private mountPanel(): void {
        effect((onCleanup) => {
            if (!this.viewReady() || !this.uiRteOutline() || this.panelRef) return;
            const contextInjector = Injector.create({
                providers: [{ provide: RICH_TEXT_OUTLINE_CONTEXT, useValue: this.buildContext() }],
                parent: this.injector,
            });
            this.panelRef = this.vcr.createComponent(RichTextOutlinePanelComponent, { injector: contextInjector });
            this.host.overlayAnchor.appendChild(this.panelRef.location.nativeElement);
            onCleanup(() => {
                this.panelRef?.destroy();
                this.panelRef = undefined;
            });
        });
    }

    private buildContext(): RichTextOutlineContext {
        return {
            locale: computed(() => this.i18n.t()),
            headings: this.headings,
            isOpen: this.panelOpen.asReadonly(),
            close: () => this.panelOpen.set(false),
            scrollTo: (index) => this.scrollHeadingIntoView(index),
            onEntryKeydown: (event, index) => this.onEntryKeydown(event, index),
        };
    }

    private teardown(): void {
        this.observer?.disconnect();
        this.observer = null;
        const root = this.host.contentRoot;
        if (root) {
            root.classList.remove(...OUTLINE_INSET_CLASSES);
        }
        this.panelRef?.destroy();
        this.panelRef = undefined;
    }
}
