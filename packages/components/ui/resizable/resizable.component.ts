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
  class = input('');
  direction = input<'horizontal' | 'vertical'>('horizontal');

  classes = computed(() => cn(
    'flex',
    this.direction() === 'vertical' ? 'flex-col h-full' : 'flex-row w-full',
    this.class()
  ));
}
