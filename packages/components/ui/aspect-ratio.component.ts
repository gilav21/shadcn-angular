import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';

@Component({
    selector: 'ui-aspect-ratio',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [style]="containerStyles()" [attr.data-slot]="'aspect-ratio'">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class AspectRatioComponent {
    ratio = input<number>(1); // width / height, e.g., 16/9 = 1.777...

    containerStyles = computed(() => ({
        position: 'relative' as const,
        width: '100%',
        paddingBottom: `${(1 / this.ratio()) * 100}%`,
    }));
}
