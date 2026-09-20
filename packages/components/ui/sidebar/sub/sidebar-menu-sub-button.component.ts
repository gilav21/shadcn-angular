import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { cn } from '../../../lib/utils';
import type {
  SidebarMenuLinkActiveOptions,
  SidebarMenuLinkCommands,
} from './sidebar-menu-link.component';

/** Row height inside a nested list. `'sm'` is the default; `'md'` matches a top-level row. */
export type SidebarMenuSubButtonSize = 'sm' | 'md';

/**
 * A row inside a nested menu. Routing works exactly as on
 * {@link SidebarMenuLinkComponent} — set `routerLink` for in-app navigation and
 * the active state follows the URL, or leave it unset and use `href` for
 * external links. See that component for why the projected label is captured
 * into an `<ng-template>` and why `target` binds differently per branch.
 */
@Component({
  selector: 'ui-sidebar-menu-sub-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, NgTemplateOutlet],
  template: `
    <ng-template #label><ng-content /></ng-template>

    @if (isRouted()) {
      <a
        [class]="classes()"
        [attr.data-slot]="'sidebar-menu-sub-button'"
        [attr.data-active]="isActiveState()"
        [attr.data-size]="size()"
        [attr.aria-current]="isActiveState() ? 'page' : null"
        [target]="target() || undefined"
        [routerLink]="commands()"
        [queryParams]="queryParams()"
        [fragment]="fragment()"
        routerLinkActive
        [routerLinkActiveOptions]="routerLinkActiveOptions()"
        (isActiveChange)="onRouteActiveChange($event)"
        (click)="navigated.emit()"
      >
        <ng-container [ngTemplateOutlet]="label" />
      </a>
    } @else {
      <a
        [class]="classes()"
        [attr.data-slot]="'sidebar-menu-sub-button'"
        [attr.data-active]="isActiveState()"
        [attr.data-size]="size()"
        [attr.aria-current]="isActiveState() ? 'page' : null"
        [attr.target]="target() || null"
        [href]="href()"
        (click)="navigated.emit()"
      >
        <ng-container [ngTemplateOutlet]="label" />
      </a>
    }
  `,
  host: { class: 'contents' },
})
export class SidebarMenuSubButtonComponent {
  /** Extra classes merged onto the `<a>`. */
  readonly class = input('');
  /** In-app destination. Setting it switches to a router-driven anchor and makes {@link isActive} follow the route. */
  readonly routerLink = input<SidebarMenuLinkCommands | undefined>(undefined);
  /** Plain `href`, used when {@link routerLink} is unset. */
  readonly href = input('#');
  /** Anchor `target`, e.g. `'_blank'`. */
  readonly target = input('');
  /** Marks the row current. Only consulted when {@link routerLink} is unset. */
  readonly isActive = input(false);
  /** Passed to `routerLinkActive`. Defaults to exact matching, since nested rows are usually leaves. */
  readonly routerLinkActiveOptions = input<SidebarMenuLinkActiveOptions>({ exact: true });
  /** Query params for the routed navigation. */
  readonly queryParams = input<Record<string, unknown> | null>(null);
  /** URL fragment for the routed navigation. */
  readonly fragment = input<string | undefined>(undefined);
  /** Row height. */
  readonly size = input<SidebarMenuSubButtonSize>('sm');
  /** Fired on click in both modes — use it to close the mobile drawer. */
  readonly navigated = output<void>();

  readonly isRouted = computed(() => this.routerLink() !== undefined);
  readonly commands = computed<SidebarMenuLinkCommands>(() => this.routerLink() ?? '');

  private readonly routeActive = signal(false);

  /** Mirrors `routerLinkActive`'s verdict into a signal. */
  onRouteActiveChange(active: boolean): void {
    this.routeActive.set(active);
  }

  readonly isActiveState = computed(() =>
    this.isRouted() ? this.routeActive() : this.isActive()
  );

  readonly classes = computed(() =>
    cn(
      'flex min-w-0 items-center gap-2 rounded-md px-2 text-sm no-underline',
      'text-sidebar-foreground/80',
      this.size() === 'sm' ? 'h-7' : 'h-8',
      'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'transition-colors',
      '[&>span]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
      this.isActiveState() && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
      this.class()
    )
  );
}
