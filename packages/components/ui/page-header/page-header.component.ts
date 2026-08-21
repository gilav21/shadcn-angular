import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    numberAttribute,
} from '@angular/core';
import { cn } from '../../lib/utils';

/** Semantic level of the {@link PageHeaderComponent} heading — `1` … `6`. */
export type PageHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * The title / description / breadcrumb / actions strip at the top of a content
 * page.
 *
 * Layout contract (UC-7): below the `sm` breakpoint (640px) the actions stack
 * *under* the heading block; from `sm` up they sit end-aligned on the same row.
 * That is the part hand-rolled versions get wrong.
 */
@Component({
    selector: 'ui-page-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './page-header.component.html',
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"page-header"',
    },
})
export class PageHeaderComponent {
    /** Heading text. Omit it and project your own heading into the actions slot. */
    readonly title = input('');
    /** Sub-heading under the title. Only rendered when it is non-empty. */
    readonly description = input('');
    /**
     * Semantic level of the heading element. Defaults to `1` because a page
     * header is normally the page's only `<h1>`; drop it to `2`+ when the page
     * already has one (risk R-3). The visual size never changes with it.
     */
    readonly headingLevel = input(1, {
        transform: (value: unknown) => clampLevel(numberAttribute(value, 1)),
    });
    /** Extra classes merged onto the host. */
    readonly class = input('');

    readonly classes = computed(() => cn('block w-full', this.class()));

    protected readonly headingClasses =
        'scroll-m-20 break-words text-2xl font-semibold tracking-tight sm:text-3xl';
}

/** Keeps `headingLevel` inside the six real heading elements. */
function clampLevel(value: number): PageHeadingLevel {
    if (!Number.isFinite(value)) return 1;
    const rounded = Math.round(value);
    if (rounded < 1) return 1;
    if (rounded > 6) return 6;
    return rounded as PageHeadingLevel;
}
