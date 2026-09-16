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
} from '@angular/core';
import { addonSetting, type RichTextAddonSetting, type RichTextAddonState, RichTextEditorAddonHost, RichTextSanitizerService, type RichTextSelectionSnapshot } from '../..';
import { createLocaleBindings, type LocaleInput } from '../../../../lib/i18n';
import { inheritThemeTokens } from '../../../../lib/theme-presets';
import { RichTextLinksFormComponent, type RichTextLinkSubmit } from './rich-text-links-form.component';
import { RichTextLinksButtonComponent } from './rich-text-links-button.component';
import {
    RICH_TEXT_LINKS_BUTTON_CONTEXT,
    type RichTextLinksButtonContext,
} from './rich-text-links.context';
import { RICH_TEXT_LINKS_LOCALES, type RichTextLinksLocale } from './rich-text-links.locales';

const LINK_SLOT_ID = 'links.insert';
const OVERLAY_WIDTH = 320;
const OVERLAY_HEIGHT = 220;
/** How far outside a link's glyph boxes a click still counts as on the link. */
const LINK_HIT_SLACK_PX = 4;

/** Where the insert/edit overlay is anchored on screen. */
interface OverlayAnchorRect {
    readonly left: number;
    readonly bottom: number;
}

/**
 * Opt-in links addon for `<ui-rich-text-editor>`. Attaches via DI to the
 * `RichTextEditorAddonHost` the base provides and owns the whole link feature:
 * the toolbar link button + popover, the `Ctrl/Cmd+K` shortcut and `/link`
 * slash command (both routed through the base's `showLinkDialog` delegation
 * seam via `registerLinkEditor`), and a click-to-edit popover on existing links
 * with remove. The base editor ships no link UI — `showLinkDialog` is inert
 * without this addon.
 *
 * Inserts route through the host's `insertHtmlAtCaret` (which sanitizes), and
 * the URL is validated with the base sanitizer first, so an unsafe URL
 * (`javascript:`…) is rejected exactly as the former built-in did. Existing link
 * content keeps rendering with the base alone; only the editing UI is opt-in.
 *
 * Strings resolve from `[uiRteLinksLocale]` (a registry key or a full
 * dictionary) or the app-wide `UI_LOCALE_ID` token — NOT the editor's own
 * `[locale]` input.
 *
 * ```html
 * <ui-rich-text-editor uiRteLinks />
 * ```
 */
@Directive({
    selector: 'ui-rich-text-editor[uiRteLinks], ui-rich-text-editor[uiRteFull]',
    standalone: true,
})
export class RichTextLinksDirective {
    private readonly host = inject(RichTextEditorAddonHost);
    private readonly sanitizer = inject(RichTextSanitizerService);
    private readonly injector = inject(Injector);
    private readonly vcr = inject(ViewContainerRef);

    /** Locale for the addon UI: a registry key (`'en'`/`'he'`/…) or a full dictionary. */
    readonly uiRteLinksLocale = input<LocaleInput<RichTextLinksLocale>>();
    /**
     * Enable the addon (the bare `uiRteLinks` attribute), or tune it: `[uiRteLinks]="{ toolbar: false }"` keeps the feature without its button, `{ order: 100 }` moves the button.
     * See {@link RichTextAddonOptions}.
     */
    readonly uiRteLinks = input<RichTextAddonState, RichTextAddonSetting>(addonSetting(320)(true), { transform: addonSetting(320) });

    /** Read this, not the whole setting, where only on/off matters: an options change must not remount the feature. */
    private readonly enabled = computed(() => this.uiRteLinks().enabled);

    /** Emits after a link is inserted or its href/text updated. */
    readonly linkInsert = output<RichTextLinkSubmit>();
    /** Emits after a link is unwrapped, carrying the removed href. */
    readonly linkRemove = output<{ url: string }>();

    private readonly i18n = createLocaleBindings(this.uiRteLinksLocale, RICH_TEXT_LINKS_LOCALES);
    private readonly seededText = signal('');
    private readonly seededUrl = signal('');
    /**
     * The anchor the toolbar popover is editing. With the caret inside a link
     * the button used to seed an empty text field and, on submit, insert a
     * SECOND link inside the first; the click-to-edit overlay already knew how
     * to update one, so the popover now does the same.
     */
    private readonly toolbarAnchor = signal<HTMLAnchorElement | null>(null);
    private readonly urlError = signal('');
    private readonly viewReady = signal(false);

    private overlayRef?: ComponentRef<RichTextLinksFormComponent>;
    private editingAnchor: HTMLAnchorElement | null = null;
    private readonly outsidePointerBound = (e: Event): void => this.onOutsidePointer(e);
    private readonly editProbeBound = (e: Event): void => this.probeEditableLink(e);
    private readonly scrollDismissBound = (e: Event): void => this.onScrollDismiss(e);
    private readonly escapeDismissBound = (e: KeyboardEvent): void => this.onEscapeDismiss(e);

    constructor() {
        afterNextRender(() => this.viewReady.set(true));
        this.registerLinkEditorSeam();
        this.registerToolbarSlot();
        this.registerSlashCommand();
        this.registerEditProbe();
        inject(DestroyRef).onDestroy(() => this.closeOverlay());
    }

    private registerLinkEditorSeam(): void {
        effect((onCleanup) => {
            if (!this.enabled()) return;
            onCleanup(this.host.registerLinkEditor((caretHint) => this.openInsertOverlay(caretHint)));
        });
    }

    private registerToolbarSlot(): void {
        const context: RichTextLinksButtonContext = {
            locale: computed(() => this.i18n.t()),
            seededText: this.seededText.asReadonly(),
            seededUrl: this.seededUrl.asReadonly(),
            editing: computed(() => this.toolbarAnchor() !== null),
            urlError: this.urlError.asReadonly(),
            onOpen: () => this.seedFromSelection(),
            onSubmit: (payload) => this.submitFromToolbar(payload),
            onRemove: () => this.removeFromToolbar(),
        };
        const slotInjector = Injector.create({
            providers: [{ provide: RICH_TEXT_LINKS_BUTTON_CONTEXT, useValue: context }],
            parent: this.injector,
        });
        effect((onCleanup) => {
            if (!this.enabled() || !this.uiRteLinks().toolbar) return;
            onCleanup(this.host.toolbarSlots.register({
                id: LINK_SLOT_ID,
                order: this.uiRteLinks().order,
                component: RichTextLinksButtonComponent,
                injector: slotInjector,
            }));
        });
    }

    private registerSlashCommand(): void {
        effect((onCleanup) => {
            if (!this.enabled() || !this.uiRteLinks().slashCommand) return;
            const l = this.i18n.t();
            onCleanup(this.host.commands.registerCommand({
                id: 'insert.link',
                label: l.commandLabel,
                description: l.commandDescription,
                keywords: ['url', 'anchor', 'link'],
                order: 100,
                run: (ctx) => ctx.showLinkDialog(),
            }));
        });
    }

    private registerEditProbe(): void {
        effect((onCleanup) => {
            if (!this.viewReady() || !this.enabled()) return;
            const root = this.host.contentRoot;
            const doc = root.ownerDocument;
            root.addEventListener('mouseup', this.editProbeBound);
            root.addEventListener('keyup', this.editProbeBound);
            doc.addEventListener('mousedown', this.outsidePointerBound);
            doc.addEventListener('keydown', this.escapeDismissBound, true);
            doc.defaultView?.addEventListener('scroll', this.scrollDismissBound, { capture: true, passive: true });
            onCleanup(() => {
                root.removeEventListener('mouseup', this.editProbeBound);
                root.removeEventListener('keyup', this.editProbeBound);
                doc.removeEventListener('mousedown', this.outsidePointerBound);
                doc.removeEventListener('keydown', this.escapeDismissBound, true);
                doc.defaultView?.removeEventListener('scroll', this.scrollDismissBound, { capture: true });
                this.closeOverlay();
            });
        });
    }

    private seedFromSelection(): void {
        // Clicking into a link opens the click-to-edit overlay, whose field
        // takes focus; the toolbar button's mousedown then closes that overlay
        // as an outside click, so by the time the popover opens the live
        // selection is nowhere. The editor saved the caret when it blurred
        // into the overlay, and that caret is inside the link.
        const overlayAnchor = this.editingAnchor;
        this.closeOverlay();
        this.host.restoreSelection();
        this.host.saveSelection();
        const selection = this.host.selection();
        const anchor = overlayAnchor ?? this.anchorHoldingSelection(selection);
        const editing = anchor instanceof HTMLAnchorElement ? anchor : null;
        this.toolbarAnchor.set(editing);
        this.seededText.set(editing ? (editing.textContent ?? '') : selection.text);
        this.seededUrl.set(editing?.getAttribute('href') ?? '');
        this.urlError.set('');
    }

    /**
     * Clear the link markup the selection covers before it is re-linked.
     *
     * The insertion replaces the selected text, which empties an anchor the
     * selection covered and leaves it in the document as an invisible
     * `<a href></a>`; inserting into that husk nests one link inside another.
     * The browser's own `unlink` is used rather than unwrapping the anchors by
     * hand, because an anchor the selection only PARTLY covers has to be split
     * at the selection boundary -- unwrapping it whole threw away the author's
     * link on the text they had not selected -- and because it leaves the live
     * selection in place, where re-anchoring boundaries by hand breaks as soon
     * as one of them is an element that the unwrap removes.
     */
    private stripLinksFromSelection(): void {
        const doc = this.host.contentRoot.ownerDocument;
        const live = doc.getSelection();
        if (!live || live.rangeCount === 0 || live.isCollapsed) return;
        const range = live.getRangeAt(0);
        const covered = Array.from(this.host.contentRoot.querySelectorAll('a'))
            .some((anchor) => range.intersectsNode(anchor));
        if (!covered) return;
        // Typed structurally, as the base does, because the DOM lib marks
        // execCommand deprecated while the editor still runs on it.
        const legacy = doc as unknown as { execCommand?: (id: string, showUI?: boolean) => boolean };
        legacy.execCommand?.('unlink', false);
    }

    /**
     * The link the popover would edit: the one the selection sits inside.
     *
     * A selection that STARTS in a link and runs past it is new link text the
     * author picked, not an edit of that link. Seeding from the anchor dropped
     * the part outside it, and submitting wrote the text into the anchor while
     * the tail stayed in the paragraph — "see docs now" became "see docs now now".
     */
    private anchorHoldingSelection(selection: RichTextSelectionSnapshot): HTMLElement | null {
        const anchor = selection.closestWithAttrs(['href']);
        if (!anchor) return null;
        const range = selection.range;
        if (range && !range.collapsed && !anchor.contains(range.endContainer)) return null;
        return anchor;
    }

    private submitFromToolbar(payload: RichTextLinkSubmit): void {
        const anchor = this.toolbarAnchor();
        if (anchor?.isConnected) {
            this.updateLink(anchor, payload);
        } else {
            this.insertLink(payload);
        }
    }

    private removeFromToolbar(): void {
        const anchor = this.toolbarAnchor();
        if (anchor?.isConnected) this.removeAnchor(anchor);
        this.toolbarAnchor.set(null);
    }

    private openInsertOverlay(caretHint?: { x: number; y: number }): void {
        if (this.host.isDisabled() || this.host.readonly()) return;
        const sel = this.host.selection();
        this.host.saveSelection();
        const ref = this.createOverlay(sel.text, '', false, this.selectionRect(sel.range, caretHint));
        ref.instance.submitLink.subscribe((payload) => this.insertLink(payload));
    }

    private openEditOverlay(anchor: HTMLAnchorElement): void {
        const ref = this.createOverlay(
            anchor.textContent ?? '',
            anchor.getAttribute('href') ?? '',
            true,
            this.rectFrom(anchor),
        );
        this.editingAnchor = anchor;
        ref.instance.submitLink.subscribe((payload) => this.updateLink(anchor, payload));
        ref.instance.removeLink.subscribe(() => this.removeAnchor(anchor));
    }

    private createOverlay(
        text: string,
        url: string,
        showRemove: boolean,
        rect: OverlayAnchorRect,
    ): ComponentRef<RichTextLinksFormComponent> {
        this.closeOverlay();
        const ref = this.vcr.createComponent(RichTextLinksFormComponent);
        inheritThemeTokens(this.vcr.element.nativeElement, ref.location.nativeElement);
        ref.setInput('locale', this.i18n.t());
        ref.setInput('text', text);
        ref.setInput('url', url);
        ref.setInput('showRemove', showRemove);
        ref.instance.cancelLink.subscribe(() => this.closeOverlay());
        this.positionOverlay(ref, rect);
        this.overlayRef = ref;
        this.focusUrlField(ref);
        return ref;
    }

    private positionOverlay(ref: ComponentRef<RichTextLinksFormComponent>, rect: OverlayAnchorRect): void {
        const el = ref.location.nativeElement as HTMLElement & { showPopover?: () => void };
        const view = this.host.contentRoot.ownerDocument.defaultView;
        const viewportWidth = view?.innerWidth ?? 1024;
        const viewportHeight = view?.innerHeight ?? 768;
        const left = Math.max(8, Math.min(rect.left, viewportWidth - OVERLAY_WIDTH - 8));
        const top = Math.max(8, Math.min(rect.bottom + 8, viewportHeight - OVERLAY_HEIGHT - 8));
        el.classList.add(
            'bg-popover', 'text-popover-foreground', 'rounded-md', 'border', 'shadow-md', 'p-3',
        );
        el.style.display = 'block';
        el.style.position = 'fixed';
        el.style.inset = 'auto';
        el.style.margin = '0';
        el.style.left = `${Math.round(left)}px`;
        el.style.top = `${Math.round(top)}px`;
        el.style.zIndex = '9999';
        if (typeof el.showPopover === 'function') {
            el.setAttribute('popover', 'manual');
            el.showPopover();
        }
    }

    private focusUrlField(ref: ComponentRef<RichTextLinksFormComponent>): void {
        queueMicrotask(() => {
            const root = ref.location.nativeElement as HTMLElement;
            root.querySelector<HTMLInputElement>('input[type="url"]')?.focus();
        });
    }

    /**
     * Surface a rejected URL in whichever form is showing. The toolbar popover
     * reads `urlError` off the context; the caret/anchor overlay is a component
     * ref, so it needs the input set directly.
     */
    private reportUrlError(): void {
        const message = this.i18n.t().invalidUrl;
        this.urlError.set(message);
        this.overlayRef?.setInput('errorMessage', message);
    }

    private insertLink(payload: RichTextLinkSubmit): void {
        const safeUrl = this.sanitizer.sanitizeUrl(payload.url);
        if (!safeUrl) {
            // Keep the form open and say why. Closing it silently discarded what
            // the user typed and was indistinguishable from a successful insert.
            this.reportUrlError();
            return;
        }
        this.urlError.set('');
        this.host.restoreSelection();
        this.stripLinksFromSelection();
        this.host.insertHtmlAtCaret(anchorHtml(safeUrl, payload.text || safeUrl));
        this.linkInsert.emit({ text: payload.text || safeUrl, url: safeUrl });
        this.closeOverlay();
    }

    private updateLink(anchor: HTMLAnchorElement, payload: RichTextLinkSubmit): void {
        const safeUrl = this.sanitizer.sanitizeUrl(payload.url);
        if (!safeUrl) {
            this.reportUrlError();
            return;
        }
        this.urlError.set('');
        const text = payload.text || safeUrl;
        this.host.mutateContent(() => {
            anchor.setAttribute('href', safeUrl);
            anchor.setAttribute('rel', 'noopener noreferrer');
            anchor.textContent = text;
        });
        this.linkInsert.emit({ text, url: safeUrl });
        this.closeOverlay();
    }

    private removeAnchor(anchor: HTMLAnchorElement): void {
        const url = anchor.getAttribute('href') ?? '';
        this.host.mutateContent(() => {
            const parent = anchor.parentNode;
            while (anchor.firstChild) parent?.insertBefore(anchor.firstChild, anchor);
            anchor.remove();
        });
        this.linkRemove.emit({ url });
        this.closeOverlay();
    }

    private probeEditableLink(event: Event): void {
        if (this.host.isDisabled() || this.host.readonly()) return;
        const el = this.host.selection().closestWithAttrs(['href']);
        const anchor = el?.tagName === 'A' && el.isContentEditable ? (el as HTMLAnchorElement) : null;
        // A click in the blank space beside or below a line parks the caret at
        // the nearest text, which may be inside a link the pointer never
        // touched. Only the link's own boxes count for a pointer; a caret moved
        // by the keyboard is the author's intent and opens on its own.
        const onLink = anchor && (!(event instanceof MouseEvent) || this.pointerOnLink(event, anchor));
        if (!onLink) {
            if (this.editingAnchor) this.closeOverlay();
            return;
        }
        if (anchor !== this.editingAnchor) {
            this.openEditOverlay(anchor);
        }
    }

    private pointerOnLink(event: MouseEvent, anchor: HTMLAnchorElement): boolean {
        for (const rect of Array.from(anchor.getClientRects())) {
            const inX = event.clientX >= rect.left - LINK_HIT_SLACK_PX && event.clientX <= rect.right + LINK_HIT_SLACK_PX;
            const inY = event.clientY >= rect.top - LINK_HIT_SLACK_PX && event.clientY <= rect.bottom + LINK_HIT_SLACK_PX;
            if (inX && inY) return true;
        }
        return false;
    }

    private onOutsidePointer(event: Event): void {
        if (!this.overlayRef) return;
        const node = event.target as Node | null;
        const overlayEl = this.overlayRef.location.nativeElement as HTMLElement;
        if (node && (overlayEl.contains(node) || this.editingAnchor?.contains(node))) return;
        this.closeOverlay();
    }

    private onEscapeDismiss(event: KeyboardEvent): void {
        if (event.key !== 'Escape' || !this.overlayRef) return;
        event.preventDefault();
        this.closeOverlay();
    }

    /**
     * Close the overlay on scroll. It is fixed-positioned, so a page or editor
     * scroll leaves it stranded away from its anchor. Scrolling within the
     * overlay's own fields is exempt and must not dismiss it.
     */
    private onScrollDismiss(event: Event): void {
        if (!this.overlayRef) return;
        const overlayEl = this.overlayRef.location.nativeElement as HTMLElement;
        const target = event.target;
        if (target instanceof Node && overlayEl.contains(target)) return;
        this.closeOverlay();
    }

    private closeOverlay(): void {
        this.overlayRef?.destroy();
        this.overlayRef = undefined;
        this.editingAnchor = null;
    }

    private selectionRect(range: Range | null, caretHint?: { x: number; y: number }): OverlayAnchorRect {
        const rect = range?.getBoundingClientRect();
        const degenerate = !rect || (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0);
        if (degenerate) {
            return { left: caretHint?.x ?? 20, bottom: caretHint?.y ?? 20 };
        }
        return { left: rect.left, bottom: rect.bottom };
    }

    private rectFrom(el: HTMLElement): OverlayAnchorRect {
        const rect = el.getBoundingClientRect();
        return { left: rect.left, bottom: rect.bottom };
    }
}


/** Escape text for safe inclusion in element content. */
function escapeHtml(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** Escape a value for safe inclusion in a double-quoted attribute. */
function escapeAttr(value: string): string {
    return escapeHtml(value).replaceAll('"', '&quot;');
}

/** Build a sanitizer-friendly anchor for a validated href + display text. */
function anchorHtml(href: string, text: string): string {
    return `<a href="${escapeAttr(href)}" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
}
