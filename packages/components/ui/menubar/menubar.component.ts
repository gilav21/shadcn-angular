import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
  inject,
  Injectable,
  ElementRef,
} from '@angular/core';
import { cn, isRtl } from '../../lib/utils';
import type { MenubarTriggerComponent } from './sub/menubar-trigger.component';

@Injectable()
export class MenubarService {
  activeMenuId = signal<string | null>(null);
  private rootEl: HTMLElement | null = null;
  menus = new Map<string, { trigger: MenubarTriggerComponent }>();

  registerRoot(el: HTMLElement) {
    this.rootEl = el;
  }

  register(id: string, trigger: MenubarTriggerComponent) {
    this.menus.set(id, { trigger });
  }

  unregister(id: string) {
    this.menus.delete(id);
  }

  setActive(id: string | null) {
    this.activeMenuId.set(id);
  }

  isActive(id: string) {
    return this.activeMenuId() === id;
  }

  isRtl(): boolean {
    if (!this.rootEl) return false;
    return isRtl(this.rootEl);
  }
}

@Component({
  selector: 'ui-menubar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MenubarService],
  template: `
    <div [class]="classes()" [attr.data-slot]="'menubar'" role="menubar">
      <ng-content />
    </div>
  `,
  host: {
    class: 'contents',
    '(document:click)': 'onClick($event)',
  },
})
export class MenubarComponent {
  class = input('');
  readonly service = inject(MenubarService);
  readonly el = inject(ElementRef);

  constructor() {
    this.service.registerRoot(this.el.nativeElement);
  }

  classes = computed(() => cn(
    'flex h-10 items-center gap-1 rounded-md border bg-background p-1',
    this.class()
  ));

  onClick(event: MouseEvent) {
    if (this.service.activeMenuId() && !this.el.nativeElement.contains(event.target)) {
      this.service.setActive(null);
    }
  }
}
