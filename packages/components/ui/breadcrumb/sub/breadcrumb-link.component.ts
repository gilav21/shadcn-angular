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
  /** Destination of the crumb, set on a plain `<a href>`. Defaults to `'#'`, so a link left unset navigates nowhere rather than breaking. For client-side routing, project a `routerLink` anchor instead of using this component. */
  href = input('#');
  /** Extra classes merged onto the anchor. Colour comes from the list (`text-muted-foreground`); only the hover state is set here. */
  class = input('');

  classes = computed(() => cn(
    'hover:text-foreground transition-colors',
    this.class()
  ));
}
