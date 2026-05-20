import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { cn } from '../../lib/utils';

/**
 * Sidebar Service - Manages sidebar state across components
 */
@Injectable()
export class SidebarService {
  isOpen = signal(true);
  isCollapsed = signal(false);
  isMobile = signal(false);

  toggle() {
    if (this.isMobile()) {
      this.isOpen.update(v => !v);
    } else {
      this.isCollapsed.update(v => !v);
    }
  }

  open() {
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
  }

  setMobile(isMobile: boolean) {
    this.isMobile.set(isMobile);
    if (isMobile) {
      this.isOpen.set(false);
    }
  }
}

/**
 * SidebarProvider - Wraps the sidebar and main content
 */
@Component({
  selector: 'ui-sidebar-provider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SidebarService],
  template: `
    <div
      [class]="classes()"
      [attr.data-slot]="'sidebar-provider'"
      [attr.data-state]="service.isOpen() ? 'open' : 'closed'"
      [attr.data-collapsed]="service.isCollapsed()"
    >
      <ng-content />
    </div>
  `,
  host: {
    class: 'contents',
    '(window:resize)': 'onResize()',
  },
})
export class SidebarProviderComponent {
  class = input('');
  readonly service = inject(SidebarService);

  constructor() {
    this.checkMobile();
  }

  classes = computed(() => cn(
    'flex min-h-screen w-full overflow-hidden',
    this.class()
  ));

  onResize() {
    this.checkMobile();
  }

  private checkMobile() {
    const isMobile = globalThis.window !== undefined && globalThis.window.innerWidth < 768;
    this.service.setMobile(isMobile);
  }
}
