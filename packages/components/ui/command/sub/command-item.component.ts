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
      [attr.id]="id"
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
  styleUrl: './command-item.component.css',
  host: { class: 'contents' },
})
export class CommandItemComponent implements OnInit, OnDestroy {
  /** Merged onto the row. The keyboard-highlighted row already gets `bg-accent text-accent-foreground`, so an accent background here will fight that state. */
  class = input('');
  /**
   * Greys the row (50% opacity) and blocks pointer events, and suppresses
   * {@link selectItem} on both click and Enter. It is *not* skipped by arrow-key
   * navigation: a disabled row can still become the highlighted item, where
   * Enter silently does nothing.
   */
  disabled = input(false);
  /**
   * Sets `aria-selected` on the row. Purely an ARIA hint for persistent
   * selection — it is independent of the keyboard highlight and applies no
   * styling of its own.
   */
  selected = input(false);
  /**
   * The text filtering matches (case-insensitive substring of the query) and the
   * payload emitted by {@link selectItem}. Read once at registration, so it must
   * be static — and an item left with the default empty value disappears as soon
   * as the user types anything.
   */
  value = input('');
  /** Key hint rendered right-aligned on the row, e.g. `⌘P`. Display only — it binds no key handler and is not matched by the search. */
  shortcut = input('');

  /** Emits {@link value} when the row is activated by click, Enter on the focused row, or Enter while it is the highlighted item. Never emits while {@link disabled}. */
  selectItem = output<string>();

  /**
   * Stable per-row id. Registered with {@link CommandService} for highlight
   * tracking AND rendered onto the `role="option"` element, because a combobox
   * points its `aria-activedescendant` at this value — an id that exists only in
   * the service is a dangling reference that announces nothing.
   */
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
    'relative flex cursor-pointer select-none items-center rounded-sm text-sm outline-none',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:bg-accent focus:text-accent-foreground',
    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
    this.isActive() && 'bg-accent text-accent-foreground',
    this.class()
  ));

  isVisible = computed(() => {
    return this.cmdService.filteredItemIds().has(this.id);
  });

  ngOnInit(): void {
    const val = this.value();
    this.cmdService.register(this.id, val, this.group?.id, () => this.onClick());
  }

  ngOnDestroy(): void {
    this.cmdService.unregister(this.id);
  }

  /**
   * Single activation path for the row — the click handler, the Enter-on-focus
   * handler, and the `onSelect` callback registered with the palette all funnel
   * here — so {@link selectItem} fires exactly once per activation and the
   * {@link disabled} guard cannot be bypassed by any of them.
   */
  onClick(): void {
    if (!this.disabled()) {
      this.cmdService.markRecent(this.value());
      this.selectItem.emit(this.value());
    }
  }
}
