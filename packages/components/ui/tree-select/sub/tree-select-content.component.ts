import {
  Component,
  ChangeDetectionStrategy,
  input,
} from '@angular/core';

@Component({
  selector: 'ui-tree-select-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-content />
  `,
  host: { class: 'contents' },
})
export class TreeSelectContentComponent {
  class = input('');
}
