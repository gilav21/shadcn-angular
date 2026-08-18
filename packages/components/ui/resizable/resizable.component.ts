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
   * Axis the panels are laid out and resized along. It is published as
   * `data-direction` on the container and each handle reads it from the DOM at
   * `ngAfterViewInit` to pick its cursor and drag axis — so changing this input
   * after init does not re-orient handles already created.
   */
  direction = input<'horizontal' | 'vertical'>('horizontal');

  classes = computed(() => cn(
    'flex',
    this.direction() === 'vertical' ? 'flex-col h-full' : 'flex-row w-full',
    this.class()
  ));
}
