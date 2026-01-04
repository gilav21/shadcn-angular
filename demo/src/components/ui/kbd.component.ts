import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../lib/utils';

/**
 * Kbd - Keyboard shortcut display component
 * 
 * Usage:
 * <ui-kbd>⌘</ui-kbd>
 * <ui-kbd>K</ui-kbd>
 * 
 * Or with multiple keys:
 * <span class="flex items-center gap-1">
 *   <ui-kbd>⌘</ui-kbd>
 *   <ui-kbd>K</ui-kbd>
 * </span>
 */
@Component({
    selector: 'ui-kbd',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <kbd [class]="classes()" [attr.data-slot]="'kbd'">
      <ng-content />
    </kbd>
  `,
    host: { class: 'contents' },
})
export class KbdComponent {
    class = input('');

    classes = computed(() => cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground',
        this.class()
    ));
}
