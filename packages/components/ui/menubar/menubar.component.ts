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

  /**
   * Stores the `<ui-menubar>` host element, used as the reference point for
   * {@link isRtl} and for the outside-click dismiss check. Called once from the
   * `MenubarComponent` constructor — consumers never call this.
   */
  registerRoot(el: HTMLElement): void {
    this.rootEl = el;
  }

  /**
   * Records a menu's trigger under its generated id so keyboard handlers in the
   * open content can reach back to it (Escape restores focus to the trigger,
   * ArrowLeft/ArrowRight move along the trigger row). Called from the
   * `MenubarTriggerComponent` constructor.
   */
  register(id: string, trigger: MenubarTriggerComponent): void {
    this.menus.set(id, { trigger });
  }

  /**
   * Drops a menu from {@link menus}. Nothing calls this today — a destroyed
   * trigger leaves a stale entry behind, so re-creating menus in a long-lived
   * page grows the map.
   */
  unregister(id: string): void {
    this.menus.delete(id);
  }

  /**
   * Opens the menu with this id and closes any other, since only one menu in a
   * menubar may be open at a time; pass `null` to close all of them.
   */
  setActive(id: string | null): void {
    this.activeMenuId.set(id);
  }

  /** Whether this menu is the single currently open one. Backs each menu's `isOpen()`. */
  isActive(id: string): boolean {
    return this.activeMenuId() === id;
  }

  /**
   * Resolves the menubar's writing direction from the computed style of the
   * root element, so arrow keys can be mirrored. Returns `false` (LTR) until
   * {@link registerRoot} has run.
   */
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
  /** Extra classes merged onto the bordered trigger row (`flex items-center rounded-md border bg-background`). */
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

  /**
   * Document-level dismiss handler: closes the open menu when the click lands
   * outside the `<ui-menubar>` element. Clicks inside — including on a
   * `ui-menubar-item` — are left to the item itself, which closes the menu via
   * its own `selected` handling. The menu content is rendered inline (not in a
   * detached overlay), so it counts as inside.
   */
  onClick(event: MouseEvent): void {
    if (this.service.activeMenuId() && !this.el.nativeElement.contains(event.target)) {
      this.service.setActive(null);
    }
  }
}
