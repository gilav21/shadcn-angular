import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    computed,
    effect,
    inject,
    input,
    viewChild,
} from '@angular/core';
import { cn } from '../../lib/utils';
import {
    RICH_TEXT_PROSE_CLASSES,
    RichTextMarkdownService,
    RichTextSanitizerService,
    type EditorMode,
    type EditorSize,
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
    host: { class: 'block' },
})
export class RichTextViewComponent {
    private readonly sanitizer = inject(RichTextSanitizerService);
    private readonly markdown = inject(RichTextMarkdownService);

    private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');

    /** The document — HTML or markdown per {@link mode}; the string the editor emits. */
    readonly value = input<string>('');
    /** How to interpret {@link value}. Defaults to `'markdown'`, matching the editor. */
    readonly mode = input<EditorMode>('markdown');
    /** Text size preset — the editor's `size` values. */
    readonly size = input<EditorSize>('default');
    /** Text direction for the content; unset inherits from the page. */
    readonly dir = input<'ltr' | 'rtl' | 'auto'>();
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
    readonly renderedHtml = computed(() =>
        this.mode() === 'markdown'
            ? this.markdown.toHtml(this.value())
            : this.sanitizer.sanitize(this.value()),
    );

    constructor() {
        effect(() => {
            const el = this.content().nativeElement;
            el.innerHTML = this.renderedHtml();
            this.freezeTaskCheckboxes(el);
        });

        const onClick = (event: Event): void => this.blockCheckboxToggle(event);
        effect((onCleanup) => {
            const host = this.content().nativeElement;
            host.addEventListener('click', onClick);
            onCleanup(() => host.removeEventListener('click', onClick));
        });
    }

    /**
     * Make rendered task checkboxes display-only: they show the authored state,
     * they are out of the tab order, and they announce as read-only. The click
     * listener above is what actually stops a toggle — `disabled` would grey
     * them out, which is a different meaning.
     */
    private freezeTaskCheckboxes(root: HTMLElement): void {
        const boxes = root.querySelectorAll<HTMLInputElement>(
            'li[data-task] input[type="checkbox"]',
        );
        for (const box of Array.from(boxes)) {
            const item = box.closest('li[data-task]') as HTMLElement | null;
            box.checked = item?.dataset['checked'] === 'true';
            box.tabIndex = -1;
            box.setAttribute('aria-readonly', 'true');
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
