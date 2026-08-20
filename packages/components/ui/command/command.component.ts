import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
  inject,
  effect,
  Injectable,
  DestroyRef,
  untracked,
} from '@angular/core';
import { cn } from '../../lib/utils';
import type { CommandPage, CommandResult, CommandSource } from './command.types';
import { readRecentValues, unshiftUniqueValue, writeRecentValues } from './command.utils';

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

  /** Async row provider, set from `ui-command`'s `source` input. `null` (default) leaves the palette purely projection-driven. */
  readonly source = signal<CommandSource | null>(null);
  /** Milliseconds of quiet typing before {@link source} is called. `0` calls it on every keystroke. */
  readonly debounceMs = signal(200);

  private readonly _results = signal<readonly CommandResult[]>([]);
  /** Rows returned by the most recent non-stale {@link source} call. Always `[]` when no source is set. */
  readonly results = this._results.asReadonly();

  private readonly _isLoading = signal(false);
  /** `true` from the moment a query is scheduled until its answer lands (or is superseded). */
  readonly isLoading = this._isLoading.asReadonly();

  private readonly _sourceError = signal<unknown>(null);
  /** Whatever the last {@link source} call threw, or `null`. A source that throws clears the results rather than propagating. */
  readonly sourceError = this._sourceError.asReadonly();

  /** Values recently selected, newest first. Fed to a "Recent" group while the query is empty. */
  readonly recents = signal<readonly string[]>([]);
  /** localStorage key for {@link recents}. `null` (default) keeps them in memory for the session only. */
  readonly recentKey = signal<string | null>(null);
  /** How many {@link recents} to keep. */
  readonly recentLimit = signal(5);

  /** `true` when the query is empty and there is at least one recent — the cue to render the "Recent" group. */
  readonly showRecents = computed(() => this.search().trim() === '' && this.recents().length > 0);

  private readonly _pages = signal<readonly CommandPage[]>([]);
  /** The drill-down stack, root-first. Empty at the top level. */
  readonly pages = this._pages.asReadonly();
  /** The page currently shown, or `null` at the top level. */
  readonly currentPage = computed(() => this._pages().at(-1) ?? null);

  private queryToken = 0;
  private debounceHandle: ReturnType<typeof setTimeout> | null = null;
  private controller: AbortController | null = null;

  constructor() {
    effect(() => {
      const visibleIds = this.filteredItemIds();
      const active = this.activeItemId();
      if (active && !visibleIds.has(active)) {
        const first = this.filteredItems()[0];
        this.activeItemId.set(first || null);
      }
    }, { allowSignalWrites: true });

    // Depends on `recentKey` ALONE. Reading `recentLimit()` here would make a
    // runtime limit change re-hydrate, and with no key that means
    // `readRecentValues(null, …)` — i.e. wiping the in-memory list the user
    // just built.
    effect(() => {
      const key = this.recentKey();
      untracked(() => {
        if (key === null) return;
        this.recents.set(readRecentValues(key, this.recentLimit()));
      });
    });

    effect(() => {
      const source = this.source();
      const query = this.search();
      const wait = this.debounceMs();
      untracked(() => this.scheduleQuery(source, query, wait));
    });

    inject(DestroyRef).onDestroy(() => this.cancelQuery());
  }

  /**
   * Records `value` as recently used: newest first, de-duplicated, capped at
   * {@link recentLimit}, and persisted when {@link recentKey} is set. Called by
   * `ui-command-item` on every activation, so the common case needs no wiring.
   */
  markRecent(value: string): void {
    if (!value) return;
    const next = unshiftUniqueValue(this.recents(), value, this.recentLimit());
    this.recents.set(next);
    writeRecentValues(this.recentKey(), next);
  }

  /** Empties {@link recents} and the persisted copy under {@link recentKey}. */
  clearRecents(): void {
    this.recents.set([]);
    writeRecentValues(this.recentKey(), []);
  }

  /** Opens a nested page. The query is cleared so the new level starts unfiltered. */
  pushPage(page: CommandPage): void {
    this._pages.update(stack => [...stack, page]);
    this.search.set('');
    this.activeItemId.set(null);
  }

  /** Returns to the parent page. Returns `false` when already at the top level. */
  popPage(): boolean {
    if (this._pages().length === 0) return false;
    this._pages.update(stack => stack.slice(0, -1));
    this.search.set('');
    this.activeItemId.set(null);
    return true;
  }

  /** Returns straight to the top level from any depth. */
  resetPages(): void {
    if (this._pages().length === 0) return;
    this._pages.set([]);
    this.search.set('');
    this.activeItemId.set(null);
  }

  private scheduleQuery(source: CommandSource | null, query: string, wait: number): void {
    this.cancelQuery();
    const token = ++this.queryToken;

    if (!source) {
      this._results.set([]);
      this._isLoading.set(false);
      this._sourceError.set(null);
      return;
    }

    this._isLoading.set(true);
    if (wait <= 0) {
      void this.runQuery(source, query, token);
      return;
    }
    this.debounceHandle = setTimeout(() => {
      this.debounceHandle = null;
      void this.runQuery(source, query, token);
    }, wait);
  }

  private async runQuery(source: CommandSource, query: string, token: number): Promise<void> {
    const controller = new AbortController();
    this.controller = controller;
    try {
      const rows = await source(query, controller.signal);
      if (token !== this.queryToken) return;
      this._results.set(rows);
      this._sourceError.set(null);
    } catch (error) {
      if (token !== this.queryToken) return;
      this._results.set([]);
      this._sourceError.set(error);
    } finally {
      if (token === this.queryToken) this._isLoading.set(false);
    }
  }

  private cancelQuery(): void {
    if (this.debounceHandle !== null) {
      clearTimeout(this.debounceHandle);
      this.debounceHandle = null;
    }
    this.controller?.abort();
    this.controller = null;
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

  /**
   * Async row provider — a server-side search, typically. Leave `null`
   * (default) and the palette stays purely projection-driven, exactly as
   * before. When set, calls are debounced by {@link debounce} and any answer a
   * newer keystroke has superseded is discarded, so results can never go
   * backwards; the superseded call's `AbortSignal` is aborted too. Read the
   * rows from {@link results} and render them as `ui-command-item`s yourself,
   * which keeps the item API — filtering, highlight, shortcuts — unchanged.
   *
   * **Set `[shouldFilter]="false"` when the source already filters.** It
   * defaults to `true`, which re-filters the rendered items client-side against
   * the same query — so a server result whose `value` does not contain the
   * typed text (a fuzzy match, a synonym, an id lookup) is fetched and then
   * silently hidden. That is the usual reason an async palette "returns
   * nothing".
   */
  readonly source = input<CommandSource | null>(null);
  /** Milliseconds of quiet typing before {@link source} is called. `0` calls it on every keystroke. */
  readonly debounce = input(200);
  /**
   * localStorage key for the recently-selected list. `null` (default) keeps
   * recents in memory for the session — the developer keeps full control by
   * reading {@link recents} and writing their own store instead.
   */
  readonly recentKey = input<string | null>(null);
  /** How many recently-selected values to keep. */
  readonly recentLimit = input(5);

  private readonly service = inject(CommandService);

  /** Rows from the latest non-stale {@link source} call. `[]` when no source is set. */
  readonly results = this.service.results;
  /** `true` while a {@link source} query is scheduled or in flight. */
  readonly isLoading = this.service.isLoading;
  /** Whatever the last {@link source} call threw, or `null`. */
  readonly sourceError = this.service.sourceError;
  /** Recently-selected values, newest first. */
  readonly recents = this.service.recents;
  /** `true` when the query is empty and there is at least one recent — render the "Recent" group on this. */
  readonly showRecents = this.service.showRecents;
  /** The drill-down page stack, root-first. Empty at the top level. */
  readonly pages = this.service.pages;
  /** The page currently shown, or `null` at the top level. Switch your template on `page()?.id`. */
  readonly page = this.service.currentPage;

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

    effect(() => {
      this.service.source.set(this.source());
      this.service.debounceMs.set(this.debounce());
      this.service.recentKey.set(this.recentKey());
      this.service.recentLimit.set(this.recentLimit());
    });
  }

  /**
   * Opens a nested page — the drill-down "submenu" pattern. The query is
   * cleared so the new level starts unfiltered. Escape (or Backspace on an
   * empty query) in `ui-command-input` returns to the parent.
   */
  pushPage(page: CommandPage): void {
    this.service.pushPage(page);
  }

  /** Returns to the parent page. Returns `false` when already at the top level. */
  popPage(): boolean {
    return this.service.popPage();
  }

  /** Returns straight to the top level from any depth. */
  resetPages(): void {
    this.service.resetPages();
  }

  /** Records a value as recently used. `ui-command-item` calls this itself on activation. */
  markRecent(value: string): void {
    this.service.markRecent(value);
  }

  /** Empties the recents list and its persisted copy. */
  clearRecents(): void {
    this.service.clearRecents();
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
