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

  registerRoot(el: HTMLElement): void {
    this.rootEl = el;
  }

  register(id: string, trigger: MenubarTriggerComponent): void {
    this.menus.set(id, { trigger });
  }

  unregister(id: string): void {
    this.menus.delete(id);
  }

  setActive(id: string | null): void {
    this.activeMenuId.set(id);
  }

  isActive(id: string): boolean {
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
  styleUrl: './menubar.component.css',
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
    'flex items-center rounded-md border bg-background',
    this.class()
  ));

  onClick(event: MouseEvent): void {
    if (this.service.activeMenuId() && !this.el.nativeElement.contains(event.target)) {
      this.service.setActive(null);
    }
  }
}
