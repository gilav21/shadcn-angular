import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../lib/utils';

/**
 * ButtonGroup - Group buttons together with seamless borders
 * 
 * Usage:
 * <ui-button-group>
 *   <ui-button variant="outline">Left</ui-button>
 *   <ui-button variant="outline">Center</ui-button>
 *   <ui-button variant="outline">Right</ui-button>
 * </ui-button-group>
 * 
 * <ui-button-group orientation="vertical">
 *   <ui-button>Top</ui-button>
 *   <ui-button>Bottom</ui-button>
 * </ui-button-group>
 */
@Component({
    selector: 'ui-button-group',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div 
      [class]="classes()"
      [attr.data-slot]="'button-group'"
      [attr.data-orientation]="orientation()"
      role="group"
    >
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class ButtonGroupComponent {
    class = input('');
    orientation = input<'horizontal' | 'vertical'>('horizontal');

    classes = computed(() => {
        const isVertical = this.orientation() === 'vertical';

        return cn(
            'flex w-fit items-stretch',
            '[&>*]:focus-visible:z-10 [&>*]:focus-visible:relative',
            isVertical ? [
                'flex-col',
                '[&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0',
                '[&>*:not(:last-child)]:rounded-b-none',
            ] : [
                '[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0',
                '[&>*:not(:last-child)]:rounded-r-none',
            ],
            this.class()
        );
    });
}

/**
 * ButtonGroupText - Static text element within a button group
 * 
 * Usage:
 * <ui-button-group>
 *   <ui-button-group-text>https://</ui-button-group-text>
 *   <ui-input />
 *   <ui-button-group-text>.com</ui-button-group-text>
 * </ui-button-group>
 */
@Component({
    selector: 'ui-button-group-text',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div 
      [class]="classes()"
      [attr.data-slot]="'button-group-text'"
    >
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class ButtonGroupTextComponent {
    class = input('');

    classes = computed(() => cn(
        'bg-muted flex items-center gap-2 rounded-md border px-4 text-sm font-medium shadow-xs',
        '[&_svg]:pointer-events-none [&_svg:not([class*="size-"])]:size-4',
        this.class()
    ));
}

/**
 * ButtonGroupSeparator - Visual separator within a button group
 */
@Component({
    selector: 'ui-button-group-separator',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div 
      [class]="classes()"
      [attr.data-slot]="'button-group-separator'"
      [attr.data-orientation]="orientation()"
      role="separator"
    ></div>
  `,
    host: { class: 'contents' },
})
export class ButtonGroupSeparatorComponent {
    class = input('');
    orientation = input<'horizontal' | 'vertical'>('vertical');

    classes = computed(() => {
        const isVertical = this.orientation() === 'vertical';

        return cn(
            'bg-border shrink-0',
            isVertical ? 'w-px self-stretch' : 'h-px self-stretch',
            this.class()
        );
    });
}
