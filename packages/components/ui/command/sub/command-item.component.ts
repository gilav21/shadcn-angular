import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { CommandService, generateId } from '../command.component';
import { COMMAND_GROUP } from './command-group.component';

@Component({
  selector: 'ui-command-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      [class]="classes()"
      [attr.data-slot]="'command-item'"
      [attr.data-disabled]="disabled() || null"
      [attr.aria-selected]="selected()"
      role="option"
      tabindex="0"
      (click)="onClick()"
      (keydown.enter)="onClick()"
      [class.hidden]="!isVisible()"
    >
      <ng-content />
      @if (shortcut()) {
        <span class="ms-auto text-xs tracking-widest text-muted-foreground">{{ shortcut() }}</span>
      }
    </div>
  `,
  host: { class: 'contents' },
})
export class CommandItemComponent implements OnInit, OnDestroy {
  class = input('');
  disabled = input(false);
  selected = input(false);
  value = input('');
  shortcut = input('');

  select = output<string>();

  readonly id = generateId();
  readonly cmdService = inject(CommandService);
  readonly group = inject(COMMAND_GROUP, { optional: true });
  readonly el = inject(ElementRef);

  isActive = computed(() => this.cmdService.activeItemId() === this.id);

  constructor() {
    effect(() => {
      if (this.isActive()) {
        this.el.nativeElement.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  classes = computed(() => cn(
    'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:bg-accent focus:text-accent-foreground',
    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
    this.isActive() && 'bg-accent text-accent-foreground',
    this.class()
  ));

  isVisible = computed(() => {
    return this.cmdService.filteredItemIds().has(this.id);
  });

  ngOnInit() {
    const val = this.value();
    this.cmdService.register(this.id, val, this.group?.id, () => this.onClick());
  }

  ngOnDestroy() {
    this.cmdService.unregister(this.id);
  }

  onClick() {
    if (!this.disabled()) {
      this.select.emit(this.value());
    }
  }
}
