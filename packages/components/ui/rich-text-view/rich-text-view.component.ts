import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    computed,
    effect,
    inject,
    input,
    output,
    viewChild,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { createLocaleBindings, type LocaleInput } from '../../lib/i18n';
import {
    RICH_TEXT_LOCALES,
    RICH_TEXT_PROSE_CLASSES,
    RichTextMarkdownService,
    RichTextAllowHost,
    RichTextSanitizerService,
    labelBlockedImages,
    reportResourceDecisions,
    type EditorMode,
    type EditorSize,
    type ResourcePolicyDecision,
    type RichTextLocale,
    type TextDirection,
} from '../rich-text-editor';

/** Text-size presets, mirroring the editor's `size` variants. */
const VIEW_SIZE_CLASSES: Record<NonNullable<EditorSize>, string> = {
    default: '',
    sm: 'text-sm',
    lg: 'text-lg',
};

/**
 * Renders what `<ui-rich-text-editor>` produced, read-only — "author here,
 * render there".
 *
 * The document goes through the same allow-list sanitizer and the same
 * markdown parser the editor uses, and carries the editor's exact typography,
 * so a published page looks like the editing surface did. It is a plain
 * container, so `[uiRichTextActions]` from the actions addon works on it (or
 * on any ancestor) with no editor anywhere on the page.
 *
 * @example
 * ```html
 * <ui-rich-text-view mode="html" [value]="post.html" size="lg" />
 * <ui-rich-text-view [value]="readme" />
 * ```
 */
@Component({
    selector: 'ui-rich-text-view',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './rich-text-view.component.html',
    styleUrl: './rich-text-view.component.css',
    host: { class: 'block' },
    providers: [
        // Per instance, so this view's resource policy is its own. The markdown
        // service comes along because it holds the sanitizer and does its own
        // image check -- left in root scope it would use the root sanitizer,
        // and since `mode` defaults to 'markdown' the policy would govern
        // nothing.
        //
        // Contributed sanitizer rules still reach here from an ancestor: the
        // sanitizer consults its enclosing instance for those, which is what
        // keeps `[uiRichTextActions]` working on a wrapper element.
        RichTextSanitizerService,
        RichTextMarkdownService,
    ],
})
export class RichTextViewComponent {
    private readonly sanitizer = inject(RichTextSanitizerService);
    private readonly markdown = inject(RichTextMarkdownService);

    /** The nearest enclosing `[uiRichTextAllow]` wrapper, if any. */
    private readonly parentAllow = inject(RichTextAllowHost, { optional: true });

    private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');

    /** The document — HTML or markdown per {@link mode}; the string the editor emits. */
    readonly value = input<string>('');
    /** How to interpret {@link value}. Defaults to `'markdown'`, matching the editor. */
    readonly mode = input<EditorMode>('markdown');

    /**
     * Hosts whose remote images and CSS backgrounds may load. Empty (the
     * default) means no policy, matching the editor and prior behaviour.
     *
     * This matters more here than in the editor. A remote image is a silent
     * request every VIEWER's browser makes on render, so a tracking pixel in
     * published content fires for each reader -- and this component is what
     * readers see. A policy set on an editor governs what an author can insert;
     * it does not travel with the document, so set the same list here.
     *
     * A blocked image keeps its element and alt and gains `data-blocked-src`,
     * so nothing is fetched and allowing the host later restores it.
     */
    readonly allowedImageHosts = input<readonly string[]>([]);

    /**
     * Link schemes allowed in addition to the built-in list, as on the editor.
     * A link a document carries is only as useful as the page that renders
     * it, so set the same list here.
     */
    readonly allowedLinkSchemes = input<readonly string[]>([]);

    /**
     * Caption shown on an image {@link allowedImageHosts} refused. Inserted
     * as text, never as markup. Unset uses the translated default from
     * {@link locale}.
     */
    readonly blockedImageMessage = input<string>();

    /**
     * Locale for the strings this component renders itself -- today only the
     * blocked-image caption. Same shape as the editor's `locale`; unset falls
     * through to the app-wide `UI_LOCALE_ID`.
     */
    readonly locale = input<LocaleInput<RichTextLocale>>();

    /**
     * Emits once per remote image or CSS background {@link allowedImageHosts}
     * refused. The view is what readers see, so this is where a block matters
     * most; the editor has the same output for what authors insert.
     */
    readonly imageBlocked = output<ResourcePolicyDecision>();

    private readonly i18n = createLocaleBindings(this.locale, RICH_TEXT_LOCALES);
    /** Text size preset — the editor's `size` values. */
    readonly size = input<EditorSize>('default');
    /** Text direction for the content; unset inherits from the page. */
    readonly dir = input<TextDirection | undefined>();
    /** Extra classes merged onto the content element. */
    readonly class = input('');

    readonly classes = computed(() =>
        cn(
            'w-full',
            RICH_TEXT_PROSE_CLASSES,
            VIEW_SIZE_CLASSES[this.size() ?? 'default'],
            this.class(),
        ),
    );

    /**
     * The sanitized markup to render. Markdown goes through `toHtml`, which
     * sanitizes its own output, so the two paths are exclusive — sanitizing a
     * second time would be wasted work, not extra safety.
     */
    readonly renderedHtml = computed(() => {
        // Read INSIDE the computed so the policy is a dependency: the sanitizer
        // holds the reader itself (set in the constructor), but without this
        // read the computed memoises against value/mode alone and a policy
        // change re-renders nothing.
        this.effectiveHosts();
        this.effectiveLinkSchemes();

        return this.mode() === 'markdown'
            ? this.markdown.toHtml(this.value())
            : this.sanitizer.sanitize(this.value());
    });

    /** This view's own host list, or an inherited one when it has none. */
    private readonly effectiveHosts = computed<readonly string[]>(() =>
        this.allowedImageHosts().length > 0 ? this.allowedImageHosts() : (this.parentAllow?.allow().imageHosts ?? []));

    private readonly effectiveLinkSchemes = computed<readonly string[]>(() =>
        this.allowedLinkSchemes().length > 0 ? this.allowedLinkSchemes() : (this.parentAllow?.allow().linkSchemes ?? []));

    constructor() {
        this.sanitizer.setRemoteHostPolicy(this.effectiveHosts);
        this.sanitizer.setLinkSchemePolicy(this.effectiveLinkSchemes);

        effect(() => {
            const el = this.content().nativeElement;
            el.innerHTML = this.renderedHtml();
            this.freezeTaskCheckboxes(el);
            labelBlockedImages(el, this.blockedImageMessage() ?? this.i18n.t().editor.blockedImage);
            this.drainResourceDecisions();
        });

        const onClick = (event: Event): void => this.blockCheckboxToggle(event);
        effect((onCleanup) => {
            const host = this.content().nativeElement;
            host.addEventListener('click', onClick);
            onCleanup(() => host.removeEventListener('click', onClick));
        });
    }

    /**
     * Report every remote resource the last render judged, then forget them.
     *
     * The sanitizer buffers its decisions and nothing but this drains them, so a
     * view that re-rendered often -- a live preview beside an editor does it on
     * every keystroke -- grew that buffer without bound. Blocked resources also
     * warn in dev mode, as the editor does: the reader lost content and only
     * the developer can allow the host.
     */
    private drainResourceDecisions(): void {
        reportResourceDecisions(
            this.sanitizer.drainResourceDecisions(),
            (decision) => this.imageBlocked.emit(decision),
            'rich-text-view',
        );
    }

    /**
     * Make rendered task checkboxes display-only: they show the authored state,
     * stay out of the tab order, and announce as unavailable.
     *
     * `aria-disabled`, not the `disabled` property. ARIA defines no readonly
     * state for `role="checkbox"`, so the original `aria-readonly` announced
     * nothing -- but a `disabled` input is skipped by screen-reader form
     * navigation entirely, and these are rendered STATE, not controls: a checked
     * task in a published document still has to be perceivable. `aria-disabled`
     * keeps it in the accessibility tree while saying it is not interactive.
     * `tabIndex = -1` and the click listener already prevent interaction.
     */
    private freezeTaskCheckboxes(root: HTMLElement): void {
        const boxes = root.querySelectorAll<HTMLInputElement>(
            'li[data-task] input[type="checkbox"]',
        );
        for (const box of Array.from(boxes)) {
            const item = box.closest('li[data-task]') as HTMLElement | null;
            box.checked = item?.dataset['checked'] === 'true';
            box.tabIndex = -1;
            // `disabled`, not `aria-readonly`. A checkbox has no readonly state
            // -- ARIA does not define aria-readonly for role="checkbox" -- so a
            // reader announced nothing while the control was also unreachable by
            // keyboard. `disabled` conveys "not interactive" natively, and the
            // click blocker stays as belt and braces for pointer events.
            box.setAttribute('aria-disabled', 'true');
            box.removeAttribute('aria-readonly');
            // Name it from the task's own text. Without this a reader announces
            // "checkbox, checked, unavailable" with no indication of WHICH task:
            // the state was perceivable and the task was not, which defeats the
            // point of keeping it in the tree at all.
            const label = item?.textContent?.trim();
            if (label) box.setAttribute('aria-label', label);
        }
    }

    /** Cancel a click on a frozen task checkbox, on mouse and on touch alike. */
    private blockCheckboxToggle(event: Event): void {
        const target = event.target as HTMLElement | null;
        if (target?.closest('li[data-task] input[type="checkbox"]')) {
            event.preventDefault();
        }
    }
}
