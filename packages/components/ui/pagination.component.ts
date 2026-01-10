import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
} from '@angular/core';
import { cn } from '../lib/utils';

@Component({
  selector: 'ui-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav 
      role="navigation" 
      aria-label="pagination" 
      [class]="classes()"
      [attr.data-slot]="'pagination'"
      [dir]="rtl() ? 'rtl' : 'ltr'"
    >
      <ng-content />
    </nav>
  `,
  host: { class: 'contents' },
})
export class PaginationComponent {
  class = input('');
  rtl = input(false);

  classes = computed(() => cn('mx-auto flex w-full justify-center', this.class()));
}

@Component({
  selector: 'ui-pagination-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  host: {
    '[class]': 'classes()',
    '[attr.data-slot]': '"pagination-content"',
  },
})
export class PaginationContentComponent {
  class = input('');

  classes = computed(() => cn('flex flex-row items-center gap-1', this.class()));
}

@Component({
  selector: 'ui-pagination-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  host: {
    '[class]': '"list-none"',
    '[attr.data-slot]': '"pagination-item"',
  },
})
export class PaginationItemComponent { }

@Component({
  selector: 'ui-pagination-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button 
      type="button"
      [class]="classes()"
      [attr.aria-current]="isActive() ? 'page' : null"
      [attr.data-slot]="'pagination-link'"
      (click)="onClick($event)"
    >
      <ng-content />
    </button>
  `,
  host: { class: 'contents' },
})
export class PaginationLinkComponent {
  isActive = input(false);
  size = input<'default' | 'sm' | 'lg' | 'icon'>('icon');
  class = input('');
  click = output<MouseEvent>();

  onClick(event: MouseEvent) {
    this.click.emit(event);
  }

  classes = computed(() => {
    const sizeClasses = {
      default: 'h-9 px-4 py-2',
      sm: 'h-8 px-3 text-xs',
      lg: 'h-10 px-8',
      icon: 'h-9 w-9',
    };
    return cn(
      'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors cursor-pointer',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
      'disabled:pointer-events-none disabled:opacity-50',
      this.isActive()
        ? 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground'
        : 'hover:bg-accent hover:text-accent-foreground',
      sizeClasses[this.size()],
      this.class()
    );
  });
}

@Component({
  selector: 'ui-pagination-previous',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" [class]="classes()" [attr.data-slot]="'pagination-previous'" (click)="onClick($event)">
      <svg class="h-4 w-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      <span>Previous</span>
    </button>
  `,
  host: { class: 'contents' },
})
export class PaginationPreviousComponent {
  class = input('');
  click = output<MouseEvent>();

  onClick(event: MouseEvent) {
    this.click.emit(event);
  }

  classes = computed(() => cn(
    'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium h-9 px-4 py-2 cursor-pointer',
    'hover:bg-accent hover:text-accent-foreground transition-colors',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
    this.class()
  ));
}

@Component({
  selector: 'ui-pagination-next',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" [class]="classes()" [attr.data-slot]="'pagination-next'" (click)="onClick($event)">
      <span>Next</span>
      <svg class="h-4 w-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  `,
  host: { class: 'contents' },
})
export class PaginationNextComponent {
  class = input('');
  click = output<MouseEvent>();

  onClick(event: MouseEvent) {
    this.click.emit(event);
  }

  classes = computed(() => cn(
    'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium h-9 px-4 py-2 cursor-pointer',
    'hover:bg-accent hover:text-accent-foreground transition-colors',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
    this.class()
  ));
}

@Component({
  selector: 'ui-pagination-ellipsis',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="classes()" [attr.data-slot]="'pagination-ellipsis'" aria-hidden="true">
      <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="19" cy="12" r="1.5" />
        <circle cx="5" cy="12" r="1.5" />
      </svg>
      <span class="sr-only">More pages</span>
    </span>
  `,
  host: { class: 'contents' },
})
export class PaginationEllipsisComponent {
  class = input('');

  classes = computed(() => cn(
    'flex h-9 w-9 items-center justify-center',
    this.class()
  ));
}
