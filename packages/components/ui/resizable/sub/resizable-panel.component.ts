import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  ElementRef,
  inject,
  effect,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-resizable-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  host: {
    '[class]': 'classes()',
    '[style.flexGrow]': '"0"',
    '[style.flexShrink]': '"0"',
    '[attr.data-slot]': '"resizable-panel"',
  },
})
export class ResizablePanelComponent {
  readonly el = inject(ElementRef);
  class = input('');
  defaultSize = input(50);
  minSize = input(10);
  maxSize = input(90);

  size = signal(50);
  sizeChange = output<number>();

  constructor() {
    effect(() => {
      this.el.nativeElement.style.flexBasis = `${this.size()}%`;
    });

    setTimeout(() => {
      this.size.set(this.defaultSize());
    }, 0);
  }

  updateSize(newSize: number) {
    this.size.set(newSize);
    this.sizeChange.emit(newSize);
  }

  classes = computed(() => cn('overflow-hidden min-h-0 min-w-0', this.class()));
}
