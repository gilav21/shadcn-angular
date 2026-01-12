import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  ElementRef,
  inject,
  OnDestroy,
  ViewChild,
  Injectable,
  contentChild,
  effect,
  OnInit,
  model,
} from '@angular/core';
import { cn } from '../lib/utils';
import { DialogComponent, DialogContentComponent } from './dialog.component';

@Injectable({
  providedIn: 'root'
})
export class CommandService {
  search = signal('');

  private items = signal<Map<string, { value: string; groupId?: string; onSelect: () => void }>>(new Map());
  activeItemId = signal<string | null>(null);

  register(id: string, value: string, groupId?: string, onSelect: () => void = () => { }) {
    this.items.update(m => {
      const newMap = new Map(m);
      newMap.set(id, { value, groupId, onSelect });
      return newMap;
    });
  }

  unregister(id: string) {
    this.items.update(m => {
      const newMap = new Map(m);
      newMap.delete(id);
      return newMap;
    });
  }

  filteredItems = computed(() => {
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

  moveNext() {
    const items = this.filteredItems();
    if (!items.length) return;
    const current = this.activeItemId();
    const idx = current ? items.indexOf(current) : -1;
    const nextIdx = (idx + 1) % items.length;
    this.activeItemId.set(items[nextIdx]);
  }

  movePrev() {
    const items = this.filteredItems();
    if (!items.length) return;
    const current = this.activeItemId();
    const idx = current ? items.indexOf(current) : -1;
    const prevIdx = (idx - 1 + items.length) % items.length;
    this.activeItemId.set(items[prevIdx]);
  }

  selectActive() {
    const activeId = this.activeItemId();
    if (activeId) {
      const item = this.items().get(activeId);
      item?.onSelect();
    }
  }
}

function generateId() {
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

  classes = computed(() => cn(
    'flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground',
    this.class()
  ));
}

@Component({
  selector: 'ui-command-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center border-b px-3" [attr.data-slot]="'command-input'">
      <svg class="h-4 w-4 shrink-0 opacity-50 ltr:mr-2 rtl:ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        #inputEl
        [class]="inputClasses()"
        [placeholder]="placeholder()"
        [value]="cmdService.search()"
        [attr.aria-label]="ariaLabel()"
        (input)="onInput($event)"
        (keydown)="onKeydown($event)"
      />
    </div>
  `,
  host: { class: 'contents' },
})
export class CommandInputComponent {
  @ViewChild('inputEl') inputEl!: ElementRef<HTMLInputElement>;
  cmdService = inject(CommandService);

  placeholder = input('Search...');
  ariaLabel = input('Search');
  value = input<string>('');

  constructor() {
    if (this.value()) {
      this.cmdService.search.set(this.value());
    }
  }

  inputClasses = computed(() => cn(
    'flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none',
    'placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50'
  ));

  onInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.cmdService.search.set(value);
    if (this.cmdService.filteredItems().length > 0) {
      this.cmdService.activeItemId.set(this.cmdService.filteredItems()[0]);
    } else {
      this.cmdService.activeItemId.set(null);
    }
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.cmdService.moveNext();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.cmdService.movePrev();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.cmdService.selectActive();
    }
  }

  focus() {
    this.inputEl?.nativeElement?.focus();
  }
}

@Component({
  selector: 'ui-command-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()" [attr.data-slot]="'command-list'" role="listbox" [attr.aria-label]="ariaLabel()">
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class CommandListComponent {
  class = input('');
  ariaLabel = input<string | undefined>(undefined);

  classes = computed(() => cn(
    'max-h-[300px] overflow-y-auto overflow-x-hidden',
    this.class()
  ));
}

@Component({
  selector: 'ui-command-empty',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
      @if (isVisible()) {
        <div class="py-6 text-center text-sm text-muted-foreground" [attr.data-slot]="'command-empty'">
            <ng-content />
        </div>
      }
  `,
  host: { class: 'contents' },
})
export class CommandEmptyComponent {
  cmdService = inject(CommandService);

  isVisible = computed(() => {
    return this.cmdService.filteredItemIds().size === 0;
  });
}

@Component({
  selector: 'ui-command-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div 
        [class]="classes()" 
        [attr.data-slot]="'command-group'" 
        role="group"
        [class.hidden]="!isVisible()"
    >
      @if (heading()) {
        <div class="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {{ heading() }}
        </div>
      }
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class CommandGroupComponent {
  heading = input('');
  class = input('');

  readonly id = generateId();
  cmdService = inject(CommandService);

  classes = computed(() => cn(
    'overflow-hidden p-1 text-foreground',
    this.class()
  ));

  isVisible = computed(() => {
    return this.cmdService.visibleGroupIds().has(this.id);
  });
}

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
    </div>
  `,
  host: { class: 'contents' },
})
export class CommandItemComponent implements OnInit, OnDestroy {
  class = input('');
  disabled = input(false);
  selected = input(false);
  value = input('');

  select = output<string>();

  readonly id = generateId();
  cmdService = inject(CommandService);
  group = inject(CommandGroupComponent, { optional: true });
  el = inject(ElementRef);

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

@Component({
  selector: 'ui-command-separator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="-mx-1 h-px bg-border" [attr.data-slot]="'command-separator'"></div>
  `,
  host: { class: 'contents' },
})
export class CommandSeparatorComponent { }

@Component({
  selector: 'ui-command-shortcut',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="text-xs tracking-widest text-muted-foreground ltr:ml-auto rtl:mr-auto" [attr.data-slot]="'command-shortcut'">
      <ng-content />
    </span>
  `,
  host: { class: 'contents' },
})
export class CommandShortcutComponent { }

@Component({
  selector: 'ui-command-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, DialogContentComponent, CommandComponent],
  template: `
    <ui-dialog [(open)]="open">
      <ui-dialog-content class="overflow-hidden p-0 shadow-lg">
        <ui-command class="**:data-[slot=command-group]:px-2 **:data-[slot=command-group]:font-medium **:data-[slot=command-group]:text-muted-foreground **:data-[slot=command-item]:px-2 **:data-[slot=command-item]:py-3 [&_[data-slot=command-item]_svg]:h-5 [&_[data-slot=command-item]_svg]:w-5">
           <ng-content />
        </ui-command>
      </ui-dialog-content>
    </ui-dialog>
  `,
  host: { class: 'contents' },
})
export class CommandDialogComponent {
  open = model(false);

  commandInput = contentChild(CommandInputComponent);

  constructor() {
    effect(() => {
      if (this.open()) {
        setTimeout(() => {
          this.commandInput()?.focus();
        });
      }
    });
  }
}
