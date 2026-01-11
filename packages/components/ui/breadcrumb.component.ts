import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  ElementRef,
  viewChild,
  inject,
} from '@angular/core';
import { cn } from '../lib/utils';

@Component({
  selector: 'ui-breadcrumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav 
      [attr.aria-label]="'breadcrumb'" 
      [attr.data-slot]="'breadcrumb'">
      <ng-content />
    </nav>
  `,
  host: { class: 'contents' },
})
export class BreadcrumbComponent {
}

@Component({
  selector: 'ui-breadcrumb-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  host: {
    '[class]': 'classes()',
    '[attr.data-slot]': '"breadcrumb-list"',
  },
})
export class BreadcrumbListComponent {
  class = input('');

  classes = computed(() => cn(
    'text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5',
    this.class()
  ));
}

@Component({
  selector: 'ui-breadcrumb-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  host: {
    '[class]': 'classes()',
    '[attr.data-slot]': '"breadcrumb-item"',
  },
})
export class BreadcrumbItemComponent {
  class = input('');

  classes = computed(() => cn('inline-flex items-center gap-1.5', this.class()));
}

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

@Component({
  selector: 'ui-breadcrumb-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  host: {
    role: 'link',
    '[attr.aria-disabled]': 'true',
    '[attr.aria-current]': '"page"',
    '[class]': 'classes()',
    '[attr.data-slot]': '"breadcrumb-page"',
  },
})
export class BreadcrumbPageComponent {
  class = input('');

  classes = computed(() => cn('text-foreground font-normal', this.class()));
}

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
  private contentWrapper = viewChild<ElementRef>('contentWrapper');

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

@Component({
  selector: 'ui-breadcrumb-ellipsis',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span role="presentation" aria-hidden="true" [class]="classes()">
      <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
        <circle cx="5" cy="12" r="1" />
      </svg>
      <span class="sr-only">More</span>
    </span>
  `,
  host: {
    class: 'contents',
    '[attr.data-slot]': '"breadcrumb-ellipsis"',
  },
})
export class BreadcrumbEllipsisComponent {
  class = input('');

  classes = computed(() => cn('flex h-9 w-9 items-center justify-center', this.class()));
}
