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

  registerTrigger(t: MenubarSubTriggerComponent): void { this.trigger = t; }
  registerContent(c: MenubarSubContentComponent): void { this.content = c; }

  enter(): void {
    clearTimeout(this.timeoutId);
    this.isOpen.set(true);
  }

  leave(): void {
    this.timeoutId = setTimeout(() => {
      this.isOpen.set(false);
    }, 100);
  }

  focusTrigger(): void {
    setTimeout(() => {
      this.trigger?.focus();
    }, 0);
  }

  focusContent(): void {
    setTimeout(() => {
      this.content?.focusFirst();
    }, 0);
  }
}
