import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
  inject,
  effect,
  Injectable,
} from '@angular/core';
import { cn } from '../../lib/utils';

export const COMMAND_DIALOG_SHORTCUT_DEFINITIONS = [
  {
    actionId: 'command-dialog.toggle',
    description: 'Toggle command dialog',
    defaultShortcut: 'Mod+K',
    category: 'Navigation',
    scope: 'global' as const,
  },
];

@Injectable({
  providedIn: 'root'
})
export class CommandService {
  search = signal('');
  shouldFilter = signal(true);

  private readonly items = signal<Map<string, { value: string; groupId?: string; onSelect: () => void }>>(new Map());
  activeItemId = signal<string | null>(null);

  constructor() {
    effect(() => {
      const visibleIds = this.filteredItemIds();
      const active = this.activeItemId();
      if (active && !visibleIds.has(active)) {
        const first = this.filteredItems()[0];
        this.activeItemId.set(first || null);
      }
    }, { allowSignalWrites: true });
  }

  /**
   * Adds an item to the palette. Called by `ui-command-item` from `ngOnInit`,
   * so registration order — and therefore the order {@link moveNext} walks —
   * is DOM order, not the order items appear in a group. The snapshot is
   * taken once: changing an item's `value` afterwards does not re-register it,
   * so {@link filteredItems} keeps matching the original value.
   * @param id Stable per-item id from `generateId()`; also the key of {@link activeItemId}.
   * @param value Lowercased substring-matched against {@link search}; an empty
   * value means the item is filtered out as soon as the user types anything.
   * @param groupId Owning `ui-command-group` id, used by {@link visibleGroupIds}
   * to hide groups whose every item was filtered away.
   * @param onSelect Invoked by {@link selectActive} on Enter; the item wires this
   * to its own click handler, so `disabled` items no-op here.
   */
  register(id: string, value: string, groupId?: string, onSelect: () => void = () => { }): void {
    this.items.update(m => {
      const newMap = new Map(m);
      newMap.set(id, { value, groupId, onSelect });
      return newMap;
    });
  }

  /**
   * Removes an item, called from the item's `ngOnDestroy`. If the removed item
   * was active the constructor effect re-points {@link activeItemId} at the
   * first still-visible item, so the highlight never dangles.
   */
  unregister(id: string): void {
    this.items.update(m => {
      const newMap = new Map(m);
      newMap.delete(id);
      return newMap;
    });
  }

  filteredItems = computed(() => {
    if (!this.shouldFilter()) {
      return Array.from(this.items().keys());
    }
    const query = this.search().toLowerCase().trim();
    const itemMap = this.items();
    const results: string[] = [];

    for (const [id, item] of itemMap.entries()) {
      if (!query || item.value.toLowerCase().includes(query)) {
        results.push(id);
      }
    }
    return results;
  });

  filteredItemIds = computed(() => new Set(this.filteredItems()));

  visibleGroupIds = computed(() => {
    const visibleItems = this.filteredItems();
    const itemMap = this.items();
    const groups = new Set<string>();

    for (const id of visibleItems) {
      const item = itemMap.get(id);
      if (item?.groupId) {
        groups.add(item.groupId);
      }
    }
    return groups;
  });

  /**
   * Moves the highlight to the next item currently passing the filter, wrapping
   * from the last back to the first. Bound to ArrowDown by `ui-command-input`.
   * With nothing active it starts at the first item. `disabled` items are *not*
   * skipped — they can become active, and Enter on one simply does nothing.
   */
  moveNext(): void {
    const items = this.filteredItems();
    if (!items.length) return;
    const current = this.activeItemId();
    const idx = current ? items.indexOf(current) : -1;
    const nextIdx = (idx + 1) % items.length;
    this.activeItemId.set(items[nextIdx]);
  }

  /**
   * Mirror of {@link moveNext} for ArrowUp: steps backwards through the filtered
   * items and wraps from the first to the last. With nothing active it lands on
   * the second-to-last item (the no-active index is `-1`, so it steps to `-2`),
   * not the last.
   */
  movePrev(): void {
    const items = this.filteredItems();
    if (!items.length) return;
    const current = this.activeItemId();
    const idx = current ? items.indexOf(current) : -1;
    const prevIdx = (idx - 1 + items.length) % items.length;
    this.activeItemId.set(items[prevIdx]);
  }

  /**
   * Runs the `onSelect` callback of the highlighted item — the Enter key path.
   * A no-op when nothing is active or when the active item has since been
   * filtered out. Because the callback is the item's own click handler, a
   * `disabled` item consumes the Enter silently instead of emitting `selectItem`.
   */
  selectActive(): void {
    const activeId = this.activeItemId();
    if (activeId) {

      if (!this.filteredItemIds().has(activeId)) return;

      const item = this.items().get(activeId);
      item?.onSelect();
    }
  }
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

@Component({
  selector: 'ui-command',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CommandService],
  template: `
    <div [class]="classes()" [attr.data-slot]="'command'">
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class CommandComponent {
  /** Merged onto the palette shell (`flex h-full w-full flex-col rounded-md bg-popover`); use it to set a height or width, since the shell only fills its parent. */
  class = input('');
  /**
   * When `true` (default) items are shown only while their `value` contains the
   * current {@link search} text, and groups with no surviving item hide too.
   * Set `false` to take over filtering yourself — every registered item then
   * stays visible and arrow-key navigation walks all of them.
   */
  shouldFilter = input(true);
  /**
   * Controlled search text. Leave at `null` (default) to let `ui-command-input`
   * own the query; any non-null value is pushed into the shared state on every
   * change, overriding what the user typed.
   */
  search = input<string | null>(null);

  private readonly service = inject(CommandService);

  constructor() {
    effect(() => {
      this.service.shouldFilter.set(this.shouldFilter());
    }, { allowSignalWrites: true });

    effect(() => {
      const s = this.search();
      if (s !== null) {
        this.service.search.set(s);
      }
    }, { allowSignalWrites: true });
  }

  classes = computed(() => cn(
    'flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground',
    this.class()
  ));

  /**
   * Imperative escape hatch — delegates to {@link CommandService.moveNext} so a
   * host that renders its own search field (instead of `ui-command-input`) can
   * drive ArrowDown itself. Same wrapping and same non-skipping of `disabled`.
   */
  moveNext(): void {
    this.service.moveNext();
  }

  /** Template-ref counterpart of {@link moveNext}, delegating to {@link CommandService.movePrev} for ArrowUp. */
  movePrev(): void {
    this.service.movePrev();
  }

  /** Template-ref counterpart of {@link moveNext} for Enter, delegating to {@link CommandService.selectActive}. */
  selectActive(): void {
    this.service.selectActive();
  }
}
