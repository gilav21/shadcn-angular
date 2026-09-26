import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

@Component({
  selector: 'ui-resizable-panel-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resizable.component.html',
  host: { class: 'contents' },
})
export class ResizablePanelGroupComponent {
  /** Extra classes merged onto the flex container. A vertical group is `h-full`, so give its parent a height or the panels collapse. */
  class = input('');
  /**
   * Axis the panels are laid out and resized along, published as
   * `data-direction` on the container. Each handle derives its orientation —
   * size, cursor, grip, `aria-orientation`, drag and arrow-key axis — from this
   * input reactively, so changing it after init re-orients existing handles.
   */
  direction = input<'horizontal' | 'vertical'>('horizontal');

  classes = computed(() => cn(
    'flex',
    this.direction() === 'vertical' ? 'flex-col h-full' : 'flex-row w-full',
    this.class()
  ));
}
