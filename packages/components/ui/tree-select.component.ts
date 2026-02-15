import {
  Component,
  ChangeDetectionStrategy,
  input,
  signal,
  computed,
  forwardRef,
  output,
  viewChild,
  effect,
  contentChild,
  InjectionToken,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn } from '../lib/utils';
import { TreeComponent, TreeNode } from './tree.component';
import { PopoverComponent, PopoverContentComponent, PopoverTriggerComponent } from './popover.component';

export const TREE_SELECT = new InjectionToken<TreeSelectComponent>('TREE_SELECT');

@Component({
  selector: 'ui-tree-select-trigger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-content />
  `,
  host: { class: 'contents' },
})
export class TreeSelectTriggerComponent {
  class = input('');
}

@Component({
  selector: 'ui-tree-select-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-content />
  `,
  host: { class: 'contents' },
})
export class TreeSelectContentComponent {
  class = input('');
}

@Component({
  selector: 'ui-tree-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TreeSelectComponent),
      multi: true,
    },
    {
      provide: TREE_SELECT,
      useExisting: forwardRef(() => TreeSelectComponent),
    },
  ],
  imports: [
    PopoverComponent,
    PopoverTriggerComponent,
    PopoverContentComponent,
    TreeComponent,
  ],
  template: `
    <ui-popover [(open)]="isOpen" [attr.data-slot]="'tree-select'">
      @if (isDataDriven()) {
        <ui-popover-trigger class="w-full">
          <button
            type="button"
            role="combobox"
            [class]="triggerClasses()"
            [disabled]="isDisabled()"
            [attr.aria-expanded]="isOpen()"
            aria-haspopup="tree"
          >
            <span class="flex-1 truncate text-left">
              @if (selectedNode(); as node) {
                {{ node.label }}
              } @else {
                <span class="text-muted-foreground">{{ placeholder() }}</span>
              }
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-4 w-4 opacity-50"
            >
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>
        </ui-popover-trigger>
        <ui-popover-content class="w-[--trigger-width] p-2" align="start">
          <ui-tree
            [data]="nodes()"
            [selectable]="'single'"
            class="w-full"
            (selectionChange)="onSelectionChange($event)"
          />
        </ui-popover-content>
      } @else {
        <ng-content />
      }
    </ui-popover>
  `,
  styles: [`
    :host {
      display: block;
    }
    ui-popover {
      width: 100%;
      display: block;
    }
  `]
})
export class TreeSelectComponent implements ControlValueAccessor {
  nodes = input<TreeNode[]>([]);
  placeholder = input('Select an item');
  disabled = input(false);
  class = input('');
  value = input<string | null | undefined>(undefined);

  selectionChange = output<string[]>();

  customTrigger = contentChild(TreeSelectTriggerComponent);
  customContent = contentChild(TreeSelectContentComponent);

  internalValue = signal<string | null>(null);
  isOpen = signal(false);

  tree = viewChild(TreeComponent);

  isDataDriven = computed(() => this.nodes().length > 0);

  selectedNode = computed(() => {
    const val = this.internalValue();
    if (!val) return null;
    return this.findNode(this.nodes(), val);
  });

  triggerClasses = computed(() => cn(
    'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
    this.class()
  ));

  isDisabled = computed(() => this.disabled() || this.formDisabled());

  private formDisabled = signal(false);
  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    effect(() => {
      const isOpen = this.isOpen();
      const tree = this.tree();
      const val = this.internalValue();

      if (isOpen && tree) {
        setTimeout(() => {
          tree.focus(val);
        }, 50);
      }
    });

    effect(() => {
      const val = this.value();
      if (val !== undefined) {
        this.internalValue.set(val);
      }
    });
  }

  writeValue(value: string | null): void {
    this.internalValue.set(value);
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }

  onSelectionChange(selection: string[]) {
    const newVal = selection[0] || null;
    this.internalValue.set(newVal);
    this.onChange(newVal);
    this.selectionChange.emit(selection);
    this.isOpen.set(false);
  }

  select(value: string | null) {
    this.internalValue.set(value);
    this.onChange(value);
    this.selectionChange.emit(value ? [value] : []);
    this.isOpen.set(false);
  }

  private findNode(nodes: TreeNode[], key: string): TreeNode | null {
    for (const node of nodes) {
      if (node.key === key) return node;
      if (node.children) {
        const found = this.findNode(node.children, key);
        if (found) return found;
      }
    }
    return null;
  }
}
