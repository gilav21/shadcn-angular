import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
  inject,
  ElementRef,
  AfterViewInit,
  effect,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { SidebarService } from './sidebar.service';

@Component({
  selector: 'ui-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Mobile overlay -->
    @if (service.isMobile() && service.isOpen()) {
      <div
        class="fixed inset-0 z-40 bg-black/50"
        role="button"
        tabindex="0"
        aria-label="Close sidebar"
        (click)="service.close()"
        (keydown.enter)="service.close()"
        (keydown.space)="onOverlayKeydown($event)"
      ></div>
    }

    <aside
      [class]="classes()"
      [attr.data-slot]="'sidebar'"
      [attr.data-state]="service.isOpen() ? 'open' : 'closed'"
      [attr.data-side]="side()"
      (keydown)="onKeydown($event)"
      tabindex="-1"
    >
      <ng-content />
    </aside>
  `,
  host: { class: 'contents' },
})
export class SidebarComponent implements AfterViewInit {
  /** Extra classes merged onto the `<aside>`. They land last, so a `w-*` utility here overrides the built-in 280px / collapsed width. */
  class = input('');
  /** Which edge the sidebar sits on. Also decides which way it slides off-screen on mobile. Note the border is always drawn with the logical `border-e`, so in RTL a `side="right"` sidebar draws its border on the outer edge. */
  side = input<'left' | 'right'>('left');
  /** Reserved styling variant. Currently inert — the rendered classes are the same for all three values. */
  variant = input<'sidebar' | 'floating' | 'inset'>('sidebar');
  /** Reserved flag for suppressing collapse. Currently inert — collapsing is driven entirely by {@link SidebarService.toggle}, which this does not gate. */
  collapsible = input(true);
  /** What collapsing looks like on desktop: `'icon'` keeps a 60px rail (labels go to `sr-only`, menu buttons show tooltips), `'hidden'` shrinks to zero width with no border. Ignored on mobile, where the sidebar slides out instead. */
  collapseMode = input<'icon' | 'hidden'>('icon');

  isMobile = signal(false);
  readonly service = inject(SidebarService);
  private readonly el = inject(ElementRef);

  private contentEl?: HTMLElement;
  private previousActiveElement?: Element | null;

  constructor() {
    effect(() => {
      const isMobileOpen = this.service.isMobile() && this.service.isOpen();
      if (isMobileOpen) {
        this.previousActiveElement = document.activeElement;
        setTimeout(() => this.focusFirstElement(), 0);
      } else if (this.previousActiveElement instanceof HTMLElement) {
        this.previousActiveElement.focus();
        this.previousActiveElement = null;
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.service.isMobile() && this.service.isOpen()) {
      this.focusFirstElement();
    }
  }

  /** Closes the mobile scrim on Space, swallowing the default so the page behind does not scroll. Enter is handled by a separate binding. */
  onOverlayKeydown(event: Event): void {
    event.preventDefault();
    this.service.close();
  }

  private focusFirstElement(): void {
    const content = this.el.nativeElement.querySelector('[data-slot="sidebar"]');
    if (content) {
      this.contentEl = content;
      const focusable = content.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;
      if (focusable) {
        focusable.focus();
      } else {
        content.focus();
      }
    }
  }

  /**
   * Modal keyboard behaviour for the **mobile** drawer only: Escape closes it and
   * Tab/Shift+Tab is cycled inside it. On desktop it returns immediately, so the
   * sidebar stays part of the normal tab order there. The focus trap re-queries
   * the DOM on each Tab, so items added while open are picked up.
   */
  onKeydown(event: KeyboardEvent): void {
    if (!this.service.isMobile() || !this.service.isOpen()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.service.close();
      return;
    }

    if (event.key === 'Tab' && this.contentEl) {
      const focusableElements = this.contentEl.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length === 0) return;

      const elements = Array.from(focusableElements) as HTMLElement[];
      const firstElement = elements[0];
      const lastElement = elements.at(-1) as HTMLElement;

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }
  }

  classes = computed(() => {
    const isMobile = this.service.isMobile();
    const isOpen = this.service.isOpen();
    const isCollapsed = this.service.isCollapsed();
    const sideValue = this.side();

    const mobileTransform = sideValue === 'left' ? '-translate-x-full' : 'translate-x-full';
    const collapsedWidth = this.collapseMode() === 'hidden' ? 'w-0 border-none overflow-hidden' : 'w-[60px]';

    return cn(
      'flex flex-col bg-sidebar text-sidebar-foreground',
      'border-e border-sidebar-border',
      isMobile ? [
        'fixed inset-y-0 z-50',
        sideValue === 'left' ? 'left-0' : 'right-0',
        'w-[280px]',
        'transition-transform duration-300 ease-in-out',
        isOpen ? 'translate-x-0' : mobileTransform,
      ] : [
        'sticky top-0 h-screen',
        'border-e border-sidebar-border hidden md:flex',
        'transition-[width] duration-300 ease-in-out',
        isCollapsed ? collapsedWidth : 'w-[280px]',
      ],
      this.class()
    );
  });
}
