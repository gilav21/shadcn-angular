import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  ElementRef,
  viewChild,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-breadcrumb-separator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span #contentWrapper class="contents"><ng-content /></span>
    @if (!hasContent()) {
      <svg class="size-3.5 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    }
  `,
  host: {
    role: 'presentation',
    '[attr.aria-hidden]': 'true',
    '[class]': 'classes()',
    '[attr.data-slot]': '"breadcrumb-separator"',
  },
})
export class BreadcrumbSeparatorComponent {
  private readonly contentWrapper = viewChild<ElementRef>('contentWrapper');

  /** Extra classes merged onto the separator host. Any projected content replaces the default chevron; the built-in `[&>svg]:size-3.5` rule sizes a custom icon to match. */
  class = input('');
  hasContent = computed(() => {
    const wrapper = this.contentWrapper();
    if (!wrapper) return false;
    const el = wrapper.nativeElement as HTMLElement;
    return Array.from(el.childNodes).some(node =>
      node.nodeType === Node.ELEMENT_NODE ||
      (node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
    );
  });

  classes = computed(() => cn('[&>svg]:size-3.5', this.class()));
}
