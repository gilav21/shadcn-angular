import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';

@Component({
  selector: 'ui-aspect-ratio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './aspect-ratio.component.html',
  host: { class: 'contents' },
})
export class AspectRatioComponent {
  ratio = input<number>(1);

  containerStyles = computed(() => ({
    position: 'relative' as const,
    width: '100%',
    paddingBottom: `${(1 / this.ratio()) * 100}%`,
  }));
}
