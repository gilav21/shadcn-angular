import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
  inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { SidebarService } from '../sidebar.service';

/**
 * The strip along the sidebar's inner edge that collapses and expands the rail.
 *
 * It is the affordance people already know from editors: the sidebar's edge is
 * the thing you grab. The strip itself is narrow and invisible at rest so it
 * does not read as a second border; hovering or focusing it fades in an accent
 * line along the full height, which is the hover state doing the explaining
 * rather than an always-on chrome element.
 *
 * It is a real `<button>` — focusable, labelled, `aria-expanded` — not a bare
 * div with a click handler, so collapsing is reachable without a mouse. It is
 * hidden on mobile, where the drawer's scrim and Escape already dismiss.
 *
 * Place it as a direct child of `ui-sidebar`, after the content:
 *
 * ```html
 * <ui-sidebar>
 *   <ui-sidebar-content>…</ui-sidebar-content>
 *   <ui-sidebar-rail />
 * </ui-sidebar>
 * ```
 */
@Component({
  selector: 'ui-sidebar-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      [class]="classes()"
      [attr.data-slot]="'sidebar-rail'"
      [attr.data-state]="service.isCollapsed() ? 'collapsed' : 'expanded'"
      [attr.aria-label]="resolvedLabel()"
      [attr.aria-expanded]="!service.isCollapsed()"
      [attr.title]="resolvedLabel()"
      (click)="service.toggle()"
      (mouseenter)="hovered.set(true)"
      (mouseleave)="hovered.set(false)"
      (focus)="focused.set(true)"
      (blur)="focused.set(false)"
    >
      <!--
        The visible line. A child rather than a border on the button so it can
        fade and thicken on hover without the 1px edge shifting the layout.
      -->
      <span aria-hidden="true" [class]="lineClasses()"></span>
    </button>
  `,
  host: { class: 'contents' },
})
export class SidebarRailComponent {
  /** Extra classes merged onto the rail button. */
  readonly class = input('');
  /**
   * Accessible name, also used as the native tooltip. Defaults to describing
   * the action the click performs, which flips with the state.
   */
  readonly label = input('');

  readonly service = inject(SidebarService);

  /*
   * The highlight is driven from component state rather than Tailwind's
   * `group-hover:`/`group-focus-visible:` variants: those utilities are not
   * emitted by this project's CSS build, so the line silently never appeared.
   * Tracking it here also makes the affordance assertable in a unit test.
   */
  protected readonly hovered = signal(false);
  protected readonly focused = signal(false);

  /** Whether the edge line is showing — hover or keyboard focus both reveal it. */
  readonly isHighlighted = computed(() => this.hovered() || this.focused());

  /** Which edge the rail hugs — mirrors the sidebar's own `side`, defaulting to the common left-hand sidebar. */
  readonly side = input<'left' | 'right'>('left');

  readonly resolvedLabel = computed(
    () => this.label() || (this.service.isCollapsed() ? 'Expand sidebar' : 'Collapse sidebar')
  );

  readonly lineClasses = computed(() =>
    cn(
      'absolute inset-y-2 w-0.5 rounded-full',
      'transition-all duration-200 ease-out motion-reduce:transition-none',
      this.isHighlighted()
        ? 'bg-sidebar-primary opacity-100'
        : 'bg-sidebar-border opacity-0',
      this.side() === 'left' ? 'end-1' : 'start-1'
    )
  );

  readonly classes = computed(() =>
    cn(
      'absolute inset-y-0 z-20 hidden w-4 md:flex',
      'items-center justify-center outline-none',
      // Sits just outside the sidebar's own edge so it never overlaps content.
      this.side() === 'left' ? '-end-2' : '-start-2',
      // The edge is a resize-like affordance, and the direction flips with state.
      this.service.isCollapsed() ? 'cursor-e-resize' : 'cursor-w-resize',
      this.class()
    )
  );
}
