import {
  Component,
  ChangeDetectionStrategy,
  signal,
  InjectionToken,
  forwardRef,
} from '@angular/core';
import type { MenubarSubTriggerComponent } from './menubar-sub-trigger.component';
import type { MenubarSubContentComponent } from './menubar-sub-content.component';

export const MENUBAR_SUB = new InjectionToken<MenubarSubComponent>('MENUBAR_SUB');

@Component({
  selector: 'ui-menubar-sub',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MENUBAR_SUB, useExisting: forwardRef(() => MenubarSubComponent) }],
  template: `<ng-content />`,
  host: { class: 'relative block w-full' },
})
export class MenubarSubComponent {
  isOpen = signal(false);
  private timeoutId: ReturnType<typeof setTimeout> | undefined;

  private trigger: MenubarSubTriggerComponent | null = null;
  private content: MenubarSubContentComponent | null = null;

  /** Wires up the child `ui-menubar-sub-trigger` so {@link focusTrigger} can reach it. Called from that component's constructor. */
  registerTrigger(t: MenubarSubTriggerComponent): void { this.trigger = t; }
  /** Wires up the child `ui-menubar-sub-content` so {@link focusContent} can reach it. Called from that component's constructor. */
  registerContent(c: MenubarSubContentComponent): void { this.content = c; }

  /**
   * Opens the submenu immediately and cancels any pending close from
   * {@link leave} — this is what makes the grace period work when the pointer
   * crosses the gap from the trigger into the panel.
   */
  enter(): void {
    clearTimeout(this.timeoutId);
    this.isOpen.set(true);
  }

  /**
   * Schedules the submenu to close after a 100ms grace period, so moving the
   * pointer off the trigger and onto the panel does not dismiss it. Calling
   * {@link enter} within that window cancels the close. The timer is not cleared
   * on destroy.
   */
  leave(): void {
    this.timeoutId = setTimeout(() => {
      this.isOpen.set(false);
    }, 100);
  }

  /**
   * Returns focus to the sub-trigger on the next macrotask — used when the
   * submenu is dismissed with the closing arrow key, after {@link leave} has
   * been called.
   */
  focusTrigger(): void {
    setTimeout(() => {
      this.trigger?.focus();
    }, 0);
  }

  /**
   * Moves focus into the submenu's first enabled item, deferred by a macrotask
   * so the panel has been rendered by the `@if (isOpen())` block first. Call
   * {@link enter} before this.
   */
  focusContent(): void {
    setTimeout(() => {
      this.content?.focusFirst();
    }, 0);
  }
}
