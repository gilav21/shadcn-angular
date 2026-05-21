import {
  Component,
  ChangeDetectionStrategy,
  input,
} from '@angular/core';

@Component({
  selector: 'ui-tree-select-trigger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-content />
  `,
  host: { class: 'contents' },
})
export class TreeSelectTriggerComponent {
  class = input('');
}
