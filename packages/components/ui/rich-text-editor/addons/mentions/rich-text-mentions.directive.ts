import {
    Directive,
    DestroyRef,
    Injector,
    ViewContainerRef,
    computed,
    effect,
    inject,
    input,
    output,
    signal,
    type ComponentRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DOCUMENT } from '@angular/common';
import { Subject, from, isObservable, of } from 'rxjs';
import { catchError, debounceTime, switchMap, tap } from 'rxjs/operators';
import { RichTextEditorAddonHost, RichTextSanitizerService } from '../..';
import { createLocaleBindings, type LocaleInput } from '../../../../lib/i18n';
import { RichTextMentionPopoverComponent } from './rich-text-mention-popover.component';
import { RICH_TEXT_MENTIONS_LOCALES, type RichTextMentionsLocale } from './rich-text-mentions.locales';
import type {
    MentionItem,
    TagItem,
    RichTextEntityInsertEvent,
    RichTextEntityRenderOptions,
    RichTextEntitySearchFn,
    RichTextEntityType,
} from './rich-text-mentions.types';
import {
    buildEntityInsertNode,
    buildEntityRenderContext,
    detectTrigger,
    selectTriggerRange,
} from './rich-text-mentions.utils';

const MAX_ITEMS = 10;
const POPOVER_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab']);
const POPOVER_WIDTH = 280;
const POPOVER_HEIGHT = 200;
const SEARCH_DEBOUNCE_MS = 200;

/**
 * Opt-in mentions/tags addon for `<ui-rich-text-editor>`. Attaches via DI to the
 * `RichTextEditorAddonHost` the base provides and owns the whole `@mention` /
 * `#tag` feature: trigger detection at the caret, the async search pipeline, the
 * candidate popover, keyboard navigation, and inserting the styled entity node.
 * The base editor keeps only content-level entity support (the sanitizer keeps
 * allowing `data-mention`/`data-tag` chips), so existing content renders with
 * the base alone; only the authoring UI is opt-in.
 *
 * Rides the base's generic seams — `registerInputObserver` (trigger pulse),
 * `registerKeydownInterceptor` (menu nav), and `mutateContent` (insertion as one
 * history entry). Strings resolve from `[uiRteMentionsLocale]` or the app-wide
 * `UI_LOCALE_ID` token — NOT the editor's own `[locale]`.
 *
 * ```html
 * <ui-rich-text-editor uiRteMentions [uiRteMentionsSearch]="searchUsers" />
 * <ui-rich-text-editor uiRteMentions [uiRteTags]="true" [uiRteTagsSearch]="searchTags" />
 * ```
 */
@Directive({
    selector: 'ui-rich-text-editor[uiRteMentions], ui-rich-text-editor[uiRteFull]',
    standalone: true,
})
export class RichTextMentionsDirective {
    private readonly host = inject(RichTextEditorAddonHost);
    private readonly sanitizer = inject(RichTextSanitizerService);
    private readonly injector = inject(Injector);
    private readonly vcr = inject(ViewContainerRef);
    private readonly document = inject(DOCUMENT);

    /** Locale for the popover UI: a registry key (`'en'`/`'he'`/…) or a full dictionary. */
    readonly uiRteMentionsLocale = input<LocaleInput<RichTextMentionsLocale>>();
    /** Enable the `@mention` trigger (the bare `uiRteMentions` attribute). */
    readonly uiRteMentions = input(true, { transform: coerceEnabled });
    /** Async/sync search returning `MentionItem[]` for `@mention` candidates. */
    readonly uiRteMentionsSearch = input<RichTextEntitySearchFn<MentionItem>>(() => []);
    /** How inserted mentions render (chip / link / text). */
    readonly uiRteMentionsRender = input<RichTextEntityRenderOptions>({ mode: 'chip' });
    /** Enable the `#tag` trigger. */
    readonly uiRteTags = input(false);
    /** Async/sync search returning `TagItem[]` for `#tag` candidates. */
    readonly uiRteTagsSearch = input<RichTextEntitySearchFn<TagItem>>(() => []);
    /** How inserted tags render (chip / link / text). */
    readonly uiRteTagsRender = input<RichTextEntityRenderOptions>({ mode: 'chip' });

    /** Emits when a mention is inserted into the editor. */
    readonly mentionInsert = output<RichTextEntityInsertEvent>();
    /** Emits when a tag is inserted into the editor. */
    readonly tagInsert = output<RichTextEntityInsertEvent>();

    private readonly i18n = createLocaleBindings(this.uiRteMentionsLocale, RICH_TEXT_MENTIONS_LOCALES);

    private readonly triggerType = signal<RichTextEntityType>('mention');
    private readonly query = signal('');
    private readonly position = signal<{ x: number; y: number }>({ x: 0, y: 0 });
    private readonly loadedItems = signal<(MentionItem | TagItem)[]>([]);
    private readonly items = computed(() => this.loadedItems().slice(0, MAX_ITEMS));

    private open = false;
    private popoverRef?: ComponentRef<RichTextMentionPopoverComponent>;
    private readonly search$ = new Subject<{ type: RichTextEntityType; query: string }>();

    constructor() {
        this.setupSearch();
        const offInput = this.host.registerInputObserver(() => this.onInput());
        const offKeydown = this.host.registerKeydownInterceptor((event) => this.onKeydown(event));
        effect(() => {
            const items = this.items();
            if (this.open) this.applyPopoverInputs(items);
        });
        inject(DestroyRef).onDestroy(() => {
            offInput();
            offKeydown();
            this.close();
        });
    }

    private get doc(): Document {
        return this.host.contentRoot.ownerDocument;
    }

    // ── Search pipeline ───────────────────────────────────────────────

    private setupSearch(): void {
        this.search$.pipe(
            debounceTime(SEARCH_DEBOUNCE_MS),
            tap(() => this.applyPopoverInputs(this.items())),
            switchMap(({ type, query }) => {
                const result = type === 'mention'
                    ? this.uiRteMentionsSearch()(query)
                    : this.uiRteTagsSearch()(query);
                if (isObservable(result)) return result;
                if (result instanceof Promise) return from(result);
                return of((result ?? []) as (MentionItem | TagItem)[]);
            }),
            catchError(() => of([] as (MentionItem | TagItem)[])),
            takeUntilDestroyed(),
        ).subscribe((items) => this.loadedItems.set(items));
    }

    // ── Trigger detection ─────────────────────────────────────────────

    private onInput(): void {
        if (this.host.disabled() || this.host.readonly()) {
            this.close();
            return;
        }
        const match = detectTrigger(this.doc, this.uiRteMentions(), this.uiRteTags());
        if (!match) {
            this.close();
            return;
        }
        this.triggerType.set(match.type);
        this.query.set(match.query);
        this.updatePosition();
        this.open = true;
        this.applyPopoverInputs(this.items());
        this.search$.next({ type: match.type, query: match.query });
    }

    // ── Keyboard ──────────────────────────────────────────────────────

    private onKeydown(event: KeyboardEvent): boolean {
        if (!this.open || !this.popoverRef || !POPOVER_KEYS.has(event.key)) {
            return false;
        }
        event.preventDefault();
        this.popoverRef.instance.onKeydown(event);
        return true;
    }

    // ── Insertion ─────────────────────────────────────────────────────

    private onSelect(item: MentionItem | TagItem): void {
        const type = this.triggerType();
        const trigger = type === 'mention' ? '@' : '#';
        const query = this.query();
        const options = type === 'mention' ? this.uiRteMentionsRender() : this.uiRteTagsRender();
        const context = buildEntityRenderContext(item, type, trigger, query);
        const { element, url } = buildEntityInsertNode(
            this.doc, context, options, (raw) => this.sanitizer.sanitizeUrl(raw),
        );

        this.ensureCaretInEditor();
        this.host.mutateContent((root) => this.insertEntity(root, element, trigger + query));

        const payload: RichTextEntityInsertEvent = {
            type, trigger, id: context.id, value: context.value, label: context.label,
            query, url, html: element.outerHTML, item,
        };
        if (type === 'mention') {
            this.mentionInsert.emit(payload);
        } else {
            this.tagInsert.emit(payload);
        }
        this.close();
        this.focusEditor();
    }

    /** The popover keeps the editor focused (buttons `preventDefault` mousedown); fall back to the saved caret if not. */
    private ensureCaretInEditor(): void {
        if (this.host.selection().range) return;
        this.host.restoreSelection();
    }

    private insertEntity(root: HTMLElement, element: HTMLElement, triggerStr: string): void {
        const selection = this.doc.getSelection();
        if (!selection || selection.rangeCount === 0) {
            root.appendChild(element);
            return;
        }
        const range = selection.getRangeAt(0);
        selectTriggerRange(this.doc, range, triggerStr, root);
        range.deleteContents();

        const trailingSpace = this.doc.createTextNode(' ');
        range.insertNode(trailingSpace);
        range.insertNode(element);

        const after = this.doc.createRange();
        after.setStart(trailingSpace, trailingSpace.length);
        after.collapse(true);
        selection.removeAllRanges();
        selection.addRange(after);
    }

    // ── Overlay ───────────────────────────────────────────────────────

    private applyPopoverInputs(items: (MentionItem | TagItem)[]): void {
        const ref = this.popoverRef ?? this.createPopover();
        ref.setInput('type', this.triggerType());
        ref.setInput('query', this.query());
        ref.setInput('items', items);
        ref.setInput('position', this.position());
        ref.setInput('locale', this.i18n.t());
        ref.changeDetectorRef.markForCheck();
    }

    private createPopover(): ComponentRef<RichTextMentionPopoverComponent> {
        const ref = this.vcr.createComponent(RichTextMentionPopoverComponent, { injector: this.injector });
        ref.instance.itemSelect.subscribe((item) => this.onSelect(item));
        ref.instance.closed.subscribe(() => this.close());
        this.host.overlayAnchor.appendChild(ref.location.nativeElement);
        this.popoverRef = ref;
        return ref;
    }

    private updatePosition(): void {
        const selection = this.doc.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const rect = selection.getRangeAt(0).getBoundingClientRect();
        const anchor = this.host.overlayAnchor.getBoundingClientRect();
        const maxX = Math.max(0, anchor.width - POPOVER_WIDTH);
        const maxY = Math.max(0, anchor.height - POPOVER_HEIGHT);
        const x = Math.max(0, Math.min(rect.left - anchor.left, maxX));
        const y = Math.max(0, Math.min(rect.bottom - anchor.top + 5, maxY));
        this.position.set({ x, y });
    }

    private close(): void {
        this.open = false;
        this.query.set('');
        this.loadedItems.set([]);
        this.popoverRef?.destroy();
        this.popoverRef = undefined;
    }

    private focusEditor(): void {
        (this.host.contentRoot as HTMLElement | null)?.focus();
    }
}

/** Coerce the bare `uiRteMentions` attribute (empty string) to `true`. */
function coerceEnabled(value: boolean | string | undefined): boolean {
    return value === '' || value === true || value === undefined;
}
