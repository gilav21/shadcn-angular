import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-breadcrumb-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a [href]="href()" [class]="classes()">
      <ng-content />
    </a>
  `,
  host: {
    class: 'contents',
    '[attr.data-slot]': '"breadcrumb-link"',
  },
})
export class BreadcrumbLinkComponent {
  href = input('#');
  class = input('');

  classes = computed(() => cn(
    'hover:text-foreground transition-colors',
    this.class()
  ));
}
