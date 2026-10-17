import {
  Component,
  ChangeDetectionStrategy,
} from '@angular/core';

/**
 * Custom-mode trigger slot. Zero-box (`display: contents`, projection only), so
 * it has no `class` input: style the element you project instead.
 */
@Component({
  selector: 'ui-tree-select-trigger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-content />
  `,
  host: { class: 'contents', '[attr.data-slot]': '"tree-select-trigger"' },
})
export class TreeSelectTriggerComponent { }
