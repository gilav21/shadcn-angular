import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

/**
 * InputGroupText - Static text within an addon
 */
@Component({
  selector: 'ui-input-group-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './input-group-text.component.html',
  host: { class: 'contents' },
})
export class InputGroupTextComponent {
  class = input('');

  classes = computed(() => cn(
    'text-muted-foreground text-sm',
    this.class()
  ));
}
