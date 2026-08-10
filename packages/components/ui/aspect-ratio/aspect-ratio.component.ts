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
  /**
   * Width-to-height ratio of the reserved box, expressed as `width / height`
   * (e.g. `16 / 9` for widescreen, `1` — the default — for a square). The box
   * always fills the available width and derives its height from this value via
   * a percentage `padding-bottom`, so the space is reserved before the projected
   * content loads and no layout shift occurs.
   */
  ratio = input<number>(1);

  containerStyles = computed(() => ({
    position: 'relative' as const,
    width: '100%',
    paddingBottom: `${(1 / this.ratio()) * 100}%`,
  }));
}
