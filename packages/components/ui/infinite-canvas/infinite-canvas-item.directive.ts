import { Directive, input } from '@angular/core';
import type { CanvasItem } from './infinite-canvas.types';

/** Context handed to the item template, mirroring `virtual-scroll`'s exactly. */
export interface CanvasItemContext<T extends CanvasItem = CanvasItem> {
  $implicit: T;
  index: number;
}

/**
 * Marks the template used to render each visible canvas item.
 *
 * Item projection is a `TemplateRef` rather than static content projection on
 * purpose: you cannot project 10,000 elements and then virtualize them. The
 * template is instantiated per *visible* item and recycled as the viewport
 * moves. This mirrors `VirtualItemDirective` in `virtual-scroll`, so the
 * convention is already established in the codebase.
 *
 * @example
 * ```html
 * <ui-infinite-canvas [items]="nodes()">
 *   <ng-template uiInfiniteCanvasItem let-node let-i="index">
 *     <my-card [data]="node" [index]="i" />
 *   </ng-template>
 * </ui-infinite-canvas>
 * ```
 *
 * @example Typed template variables
 * Angular resolves a template's context from the directive alone, which cannot
 * see the canvas's generic argument — so `let-node` is a plain
 * {@link CanvasItem} by default and your own fields are invisible to the
 * compiler. Bind {@link ofType} to the same array to recover the real type:
 * ```html
 * <ng-template uiInfiniteCanvasItem [ofType]="nodes()" let-node>
 *   {{ node.yourOwnField }}
 * </ng-template>
 * ```
 */
@Directive({
  selector: '[uiInfiniteCanvasItem]',
  standalone: true,
})
export class InfiniteCanvasItemDirective<T extends CanvasItem = CanvasItem> {
  /**
   * Type-inference anchor. Bind the same array passed to the canvas's `items`
   * and the template variables take that element type; the value itself is
   * never read. This mirrors how `*ngFor` infers from `ngForOf`.
   */
  readonly ofType = input<readonly T[] | undefined>(undefined);

  /* eslint-disable @typescript-eslint/no-unused-vars -- dir and ctx required by Angular's type-narrowing contract */
  static ngTemplateContextGuard<T extends CanvasItem>(
    dir: InfiniteCanvasItemDirective<T>,
    ctx: unknown,
  ): ctx is CanvasItemContext<T> {
    return true;
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}
