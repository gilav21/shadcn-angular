import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  inject,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import type { IsActiveMatchOptions, Params, QueryParamsHandling } from '@angular/router';
import { cn } from '../../../lib/utils';
import { SidebarService } from '../sidebar.service';

/** What `routerLink` accepts: the same shape `RouterLink` itself takes. */
export type SidebarMenuLinkCommands = readonly unknown[] | string;

/** How `routerLinkActive` decides the link is current. Mirrors `RouterLinkActive.routerLinkActiveOptions`. */
export type SidebarMenuLinkActiveOptions = { exact: boolean } | Partial<IsActiveMatchOptions>;

@Component({
  selector: 'ui-sidebar-menu-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, NgTemplateOutlet],
  template: `
    <!--
      The projected content is captured once into \`label\` and rendered into
      whichever anchor is live. Two \`<ng-content />\` tags would not work: a
      component may only instantiate its projection once, so the second branch
      would render an empty anchor.
    -->
    <ng-template #label><ng-content /></ng-template>

    @if (isRouted()) {
      <a
        [class]="classes()"
        [attr.data-slot]="'sidebar-menu-link'"
        [attr.data-active]="isActiveState()"
        [attr.data-collapsed]="isCollapsedState()"
        [attr.aria-current]="isActiveState() ? 'page' : null"
        [target]="target() || undefined"
        [routerLink]="commands()"
        [queryParams]="queryParams()"
        [fragment]="fragment()"
        [queryParamsHandling]="queryParamsHandling()"
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
        [attr.data-slot]="'sidebar-menu-link'"
        [attr.data-active]="isActiveState()"
        [attr.data-collapsed]="isCollapsedState()"
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
export class SidebarMenuLinkComponent {
  /** Extra classes merged onto the `<a>`. */
  readonly class = input('');
  /**
   * In-app destination, passed straight to `routerLink` — a string or a commands
   * array. Setting it switches the component to a router-driven anchor, and
   * {@link isActive} then follows the real route instead of the input. Leave it
   * unset for external or non-routed links and use {@link href} instead.
   *
   * Requires the app to provide a router (`provideRouter`). Apps without one
   * must leave this unset; the `href` branch injects nothing router-related.
   */
  readonly routerLink = input<SidebarMenuLinkCommands | undefined>(undefined);
  /** Plain `href`, used when {@link routerLink} is unset — external links, `mailto:`, downloads. */
  readonly href = input('#');
  /**
   * Anchor `target`, e.g. `'_blank'` for external links. Applies to both modes,
   * but reaches the DOM differently: the href branch sets the attribute, while
   * the routed branch binds `RouterLink.target`, because `RouterLink` writes
   * that attribute itself and would overwrite a plain `[attr.target]`.
   */
  readonly target = input('');
  /**
   * Marks the link as current — accent background, `data-active` and
   * `aria-current="page"`. **Only consulted when {@link routerLink} is unset**:
   * with a `routerLink` the active state is derived from `routerLinkActive`, so
   * the route is the single source of truth and this input is ignored.
   */
  readonly isActive = input(false);
  /** Passed to `routerLinkActive`. Default `{ exact: false }` marks parents of the active route active too; pass `{ exact: true }` for leaf-only highlighting. */
  readonly routerLinkActiveOptions = input<SidebarMenuLinkActiveOptions>({ exact: false });
  /** Query params for the `routerLink` navigation. Ignored in `href` mode. */
  readonly queryParams = input<Params | null>(null);
  /** URL fragment for the `routerLink` navigation. Ignored in `href` mode. */
  readonly fragment = input<string | undefined>(undefined);
  /** How existing query params are carried over. Ignored in `href` mode. */
  readonly queryParamsHandling = input<QueryParamsHandling | null>(null);
  /**
   * Fired on click in both modes. The common use is closing the mobile drawer
   * after navigating — the component deliberately does not do it for you, since
   * whether a nav item should dismiss the sidebar is an app decision.
   */
  readonly navigated = output<void>();

  readonly service = inject(SidebarService);

  /**
   * Whether to render the routed anchor. An empty string is a legitimate route
   * (`routerLink=""` means "this route"), so the test is against `undefined`
   * rather than truthiness — which is also why the template cannot use
   * `@if (commands(); as link)`: the alias form would drop `''` into the href
   * branch.
   */
  readonly isRouted = computed(() => this.routerLink() !== undefined);

  /** The value handed to `routerLink`; `''` when unset, which the href branch never reads. */
  readonly commands = computed<SidebarMenuLinkCommands>(() => this.routerLink() ?? '');

  private readonly routeActive = signal(false);

  /**
   * Mirrors `routerLinkActive`'s verdict into a signal so {@link isActiveState}
   * can read it. The directive recomputes on every `NavigationEnd` and on link
   * input changes, so this is the only hook needed to keep the rendered state
   * in step with the URL.
   *
   * Note for tests: `RouterLinkActive.update()` defers into a `queueMicrotask`,
   * so this lands one microtask after `navigateByUrl` resolves — a synchronous
   * `detectChanges()` straight after navigating reads the previous state.
   */
  onRouteActiveChange(active: boolean): void {
    this.routeActive.set(active);
  }

  /** The active state actually rendered: route-derived when routing, otherwise the {@link isActive} input. */
  readonly isActiveState = computed(() =>
    this.isRouted() ? this.routeActive() : this.isActive()
  );

  readonly isCollapsedState = computed(() => this.service.isCollapsed() && !this.service.isMobile());

  readonly classes = computed(() => {
    const isCollapsed = this.isCollapsedState();

    return cn(
      'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm',
      'text-sidebar-foreground no-underline',
      'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'transition-colors',
      this.isActiveState() && 'bg-sidebar-accent text-sidebar-accent-foreground',
      isCollapsed && 'justify-center px-2 overflow-hidden [&>span:not(:first-child)]:hidden [&>svg]:shrink-0',
      this.class()
    );
  });
}
