import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

/**
 * Empty - Empty state placeholder for lists, tables, etc.
 * 
 * Usage:
 * <ui-empty>
 *   <ui-empty-header>
 *     <ui-empty-media>
 *       <svg>...</svg>
 *     </ui-empty-media>
 *     <ui-empty-title>No results found</ui-empty-title>
 *     <ui-empty-description>Try adjusting your search</ui-empty-description>
 *   </ui-empty-header>
 *   <ui-empty-content>
 *     <button>Create new</button>
 *   </ui-empty-content>
 * </ui-empty>
 */
@Component({
    selector: 'ui-empty',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'empty'">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class EmptyComponent {
    class = input('');

    classes = computed(() => cn(
        'flex min-w-0 flex-1 flex-col items-center justify-center gap-4 sm:gap-6 rounded-lg border border-dashed p-4 sm:p-6 text-center text-balance md:p-12',
        this.class()
    ));
}
