import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
  ElementRef,
  ViewChild,
  booleanAttribute,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { isTouchDevice } from '../../../lib/touch';
import { MenubarService } from '../menubar.component';
import { MENUBAR_SUB, type MenubarSubComponent } from './menubar-sub.component';

@Component({
  selector: 'ui-menubar-sub-trigger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #trigger
      [class]="classes()"
      [attr.data-slot]="'menubar-sub-trigger'"
      role="menuitem"
      [attr.aria-haspopup]="true"
      [attr.aria-expanded]="sub.isOpen()"
      tabindex="0"
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()"
      (keydown)="onKeydown($event)"
      (click)="onClick()"
    >
      <ng-content />
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 ltr:ml-auto rtl:mr-auto rtl:rotate-180"><path d="m9 18 6-6-6-6"/></svg>
    </div>
  `,
  styleUrl: './menubar-sub-trigger.component.css',
  host: { class: 'contents' }
})
export class MenubarSubTriggerComponent {
  class = input('');
  disabled = input(false, { transform: booleanAttribute });
  inset = input(false, { transform: booleanAttribute });

  readonly sub = inject(MENUBAR_SUB) as MenubarSubComponent;
  readonly service = inject(MenubarService);
  readonly el = inject(ElementRef);

  @ViewChild('trigger') triggerEl!: ElementRef<HTMLElement>;

  constructor() {
    this.sub.registerTrigger(this);
  }

  classes = computed(() => cn(
    'relative flex cursor-pointer select-none items-center rounded-sm text-sm outline-none',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:bg-accent focus:text-accent-foreground',
    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
    this.sub.isOpen() && 'bg-accent text-accent-foreground',
    this.inset() && 'ltr:pl-8 rtl:pr-8',
    this.class()
  ));

  onMouseEnter(): void {
    if (isTouchDevice()) return;
    this.sub.enter();
  }

  onMouseLeave(): void {
    if (isTouchDevice()) return;
    this.sub.leave();
  }

  onClick(): void {
    if (!isTouchDevice()) return;
    if (this.sub.isOpen()) {
      this.sub.leave();
    } else {
      this.sub.enter();
    }
  }

  focus(): void {
    this.triggerEl?.nativeElement.focus();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight') {
      if (this.service.isRtl()) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.sub.enter();
      this.sub.focusContent();
    }
    if (event.key === 'ArrowLeft') {
      if (this.service.isRtl()) {
        event.preventDefault();
        event.stopPropagation();
        this.sub.enter();
        this.sub.focusContent();
      }
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      this.sub.enter();
      this.sub.focusContent();
    }
  }
}
