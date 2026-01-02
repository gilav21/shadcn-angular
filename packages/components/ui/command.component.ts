import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    ElementRef,
    inject,
    AfterViewInit,
    OnDestroy,
    ViewChild,
} from '@angular/core';
import { cn } from '../lib/utils';

export interface CommandItem {
    id: string;
    label: string;
    value: string;
    icon?: string;
    shortcut?: string;
    disabled?: boolean;
    group?: string;
}

@Component({
    selector: 'ui-command',
    changeDetection: ChangeDetectionStrategy.OnPush,
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
      <svg class="mr-2 h-4 w-4 shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        #inputEl
        [class]="inputClasses()"
        [placeholder]="placeholder()"
        [value]="value()"
        (input)="onInput($event)"
        (keydown)="onKeydown($event)"
      />
    </div>
  `,
    host: { class: 'contents' },
})
export class CommandInputComponent {
    @ViewChild('inputEl') inputEl!: ElementRef<HTMLInputElement>;

    placeholder = input('Search...');
    value = signal('');
    valueChange = output<string>();

    inputClasses = computed(() => cn(
        'flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none',
        'placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50'
    ));

    onInput(event: Event) {
        const value = (event.target as HTMLInputElement).value;
        this.value.set(value);
        this.valueChange.emit(value);
    }

    onKeydown(event: KeyboardEvent) {
        // Handle keyboard navigation
    }

    focus() {
        this.inputEl?.nativeElement?.focus();
    }
}

@Component({
    selector: 'ui-command-list',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'command-list'" role="listbox">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class CommandListComponent {
    class = input('');

    classes = computed(() => cn(
        'max-h-[300px] overflow-y-auto overflow-x-hidden',
        this.class()
    ));
}

@Component({
    selector: 'ui-command-empty',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div class="py-6 text-center text-sm text-muted-foreground" [attr.data-slot]="'command-empty'">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class CommandEmptyComponent { }

@Component({
    selector: 'ui-command-group',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'command-group'" role="group">
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

    classes = computed(() => cn(
        'overflow-hidden p-1 text-foreground',
        this.class()
    ));
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
    >
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class CommandItemComponent {
    class = input('');
    disabled = input(false);
    selected = input(false);
    value = input('');

    select = output<string>();

    classes = computed(() => cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
        'hover:bg-accent hover:text-accent-foreground',
        'focus:bg-accent focus:text-accent-foreground',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        this.selected() && 'bg-accent text-accent-foreground',
        this.class()
    ));

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
    <span class="ml-auto text-xs tracking-widest text-muted-foreground" [attr.data-slot]="'command-shortcut'">
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class CommandShortcutComponent { }
