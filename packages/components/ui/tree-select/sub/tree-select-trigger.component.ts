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
  /**
   * Extra classes for the trigger slot. The host renders as `contents` and
   * projects its content verbatim, so style the element you project instead —
   * this input exists for API symmetry and is not applied to any element.
   */
  class = input('');
}
