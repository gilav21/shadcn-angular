import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

/**
 * InputGroupAddon - Addon elements (icons, text, buttons) within an input group
 */
@Component({
  selector: 'ui-input-group-addon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './input-group-addon.component.html',
  host: { class: 'contents' },
})
export class InputGroupAddonComponent {
  class = input('');
  align = input<'inline-start' | 'inline-end'>('inline-start');

  classes = computed(() => cn(
    'text-muted-foreground flex h-auto items-center justify-center gap-2 py-1.5 text-sm font-medium select-none',
    '[&>svg:not([class*="size-"])]:size-4',
    this.align() === 'inline-start' ? 'pl-3 pr-1' : 'pl-1 pr-3',
    this.class()
  ));
}
