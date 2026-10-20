import { Directive } from '@angular/core';
import type { FieldMapperLinkLabelContext } from '../field-mapper.types';

/**
 * Marks the `<ng-template>` that renders a short label beside each line of a
 * `<ui-field-mapper>`, placed in the gutter at the line's midpoint. Keep it
 * short: it has the gutter's width to fit in.
 *
 * Template context: {@link FieldMapperLinkLabelContext} — `let-link` is the
 * link, `let-start="start"` and `let-end="end"` the items it joins.
 *
 * ```html
 * <ng-template uiFieldMapperLinkLabel let-link>{{ coverage(link) }}</ng-template>
 * ```
 */
@Directive({
    selector: '[uiFieldMapperLinkLabel]',
})
export class FieldMapperLinkLabelDirective {
    static ngTemplateContextGuard(
        _dir: FieldMapperLinkLabelDirective,
        _ctx: unknown,
    ): _ctx is FieldMapperLinkLabelContext {
        return true;
    }
}
