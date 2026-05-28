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
        (click)="service.close()"
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
  class = input('');
  side = input<'left' | 'right'>('left');
  variant = input<'sidebar' | 'floating' | 'inset'>('sidebar');
  collapsible = input(true);
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

  ngAfterViewInit() {
    if (this.service.isMobile() && this.service.isOpen()) {
      this.focusFirstElement();
    }
  }

  private focusFirstElement() {
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

  onKeydown(event: KeyboardEvent) {
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
      const lastElement = elements.at(-1)!;

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
