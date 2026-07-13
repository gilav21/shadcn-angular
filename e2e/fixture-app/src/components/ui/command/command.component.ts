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
import { cn } from '@/components/lib/utils';

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

  register(id: string, value: string, groupId?: string, onSelect: () => void = () => { }): void {
    this.items.update(m => {
      const newMap = new Map(m);
      newMap.set(id, { value, groupId, onSelect });
      return newMap;
    });
  }

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

  moveNext(): void {
    const items = this.filteredItems();
    if (!items.length) return;
    const current = this.activeItemId();
    const idx = current ? items.indexOf(current) : -1;
    const nextIdx = (idx + 1) % items.length;
    this.activeItemId.set(items[nextIdx]);
  }

  movePrev(): void {
    const items = this.filteredItems();
    if (!items.length) return;
    const current = this.activeItemId();
    const idx = current ? items.indexOf(current) : -1;
    const prevIdx = (idx - 1 + items.length) % items.length;
    this.activeItemId.set(items[prevIdx]);
  }

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
  class = input('');
  shouldFilter = input(true);
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

  moveNext(): void {
    this.service.moveNext();
  }

  movePrev(): void {
    this.service.movePrev();
  }

  selectActive(): void {
    this.service.selectActive();
  }
}
