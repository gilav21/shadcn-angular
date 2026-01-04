import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../lib/utils';

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
        'flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border border-dashed p-6 text-center text-balance md:p-12',
        this.class()
    ));
}

/**
 * EmptyHeader - Container for icon, title, and description
 */
@Component({
    selector: 'ui-empty-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'empty-header'">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class EmptyHeaderComponent {
    class = input('');

    classes = computed(() => cn(
        'flex max-w-sm flex-col items-center gap-2 text-center',
        this.class()
    ));
}

/**
 * EmptyMedia - Container for icon or illustration
 */
@Component({
    selector: 'ui-empty-media',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'empty-media'">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class EmptyMediaComponent {
    class = input('');
    variant = input<'default' | 'icon'>('default');

    classes = computed(() => cn(
        'flex shrink-0 items-center justify-center mb-2 [&_svg]:pointer-events-none [&_svg]:shrink-0',
        this.variant() === 'icon' && 'bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg:not([class*="size-"])]:size-6',
        this.class()
    ));
}

/**
 * EmptyTitle - Title text
 */
@Component({
    selector: 'ui-empty-title',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'empty-title'">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class EmptyTitleComponent {
    class = input('');

    classes = computed(() => cn(
        'text-lg font-medium tracking-tight',
        this.class()
    ));
}

/**
 * EmptyDescription - Description text
 */
@Component({
    selector: 'ui-empty-description',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <p [class]="classes()" [attr.data-slot]="'empty-description'">
      <ng-content />
    </p>
  `,
    host: { class: 'contents' },
})
export class EmptyDescriptionComponent {
    class = input('');

    classes = computed(() => cn(
        'text-muted-foreground text-sm/relaxed [&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4',
        this.class()
    ));
}

/**
 * EmptyContent - Container for actions/buttons
 */
@Component({
    selector: 'ui-empty-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'empty-content'">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class EmptyContentComponent {
    class = input('');

    classes = computed(() => cn(
        'flex flex-col items-center gap-3',
        this.class()
    ));
}
