import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

/**
 * InputGroupAddon - Addon elements (icons, text, buttons) within an input group
 */
@Component({
  selector: 'ui-input-group-addon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './input-group-addon.component.html',
  styleUrl: './input-group-addon.component.css',
  host: { class: 'contents' },
})
export class InputGroupAddonComponent {
  class = input('');
  align = input<'inline-start' | 'inline-end'>('inline-start');

  classes = computed(() => cn(
    'text-muted-foreground flex h-auto items-center justify-center gap-2 py-1.5 text-sm font-medium select-none',
    '[&>svg:not([class*="size-"])]:size-4',
    this.align() === 'inline-start' ? 'ps-3 pe-1' : 'ps-1 pe-3',
    this.class()
  ));
}
