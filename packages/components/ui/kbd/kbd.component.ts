import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

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
    templateUrl: './kbd.component.html',
    host: { class: 'contents' },
})
export class KbdComponent {
    /**
     * Extra classes merged onto the rendered `<kbd>` element. Merged with `cn`,
     * so a conflicting Tailwind utility here overrides the built-in one
     * (e.g. `text-xs` replaces the default `text-[10px]`).
     */
    class = input('');

    classes = computed(() => cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground',
        this.class()
    ));
}
