import { Directive } from '@angular/core';
import type { FieldMapperItemContext } from '../field-mapper.types';

/**
 * Marks the `<ng-template>` that renders each item of a `<ui-field-mapper>`,
 * in place of its plain label. The item stays the hit target and keeps its
 * handle; the template only fills it.
 *
 * Template context: {@link FieldMapperItemContext} — `let-item` is the item,
 * `let-side="side"` its list, `let-linked="linked"` whether it holds a link.
 *
 * ```html
 * <ng-template uiFieldMapperItem let-item let-side="side">
 *   <span dir="auto">{{ item.label }}</span>
 * </ng-template>
 * ```
 */
@Directive({
    selector: '[uiFieldMapperItem]',
})
export class FieldMapperItemDirective {
    static ngTemplateContextGuard(
        _dir: FieldMapperItemDirective,
        _ctx: unknown,
    ): _ctx is FieldMapperItemContext {
        return true;
    }
}
