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
  /** Extra classes merged onto the addon. Any unsized projected `<svg>` is already scaled to `size-4`, so icons need no extra classes. */
  class = input('');
  /**
   * Which side of the input the addon sits on, emitted as `data-align` and used
   * by the group's CSS for padding and divider rules. Logical, so `inline-start`
   * is the left in LTR and the right in RTL. It does not reorder the DOM — place
   * the addon before or after the input in the markup to match.
   */
  align = input<'inline-start' | 'inline-end'>('inline-start');

  classes = computed(() => cn(
    'text-muted-foreground flex h-auto items-center justify-center gap-2 text-sm font-medium select-none',
    '[&>svg:not([class*="size-"])]:size-4',
    this.class()
  ));
}
