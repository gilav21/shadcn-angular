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
import { cn } from '../../lib/utils';
import { COMMON_LOCALES, type CommonLocale, createLocaleBindings, type LocaleInput } from '../../lib/i18n';
import { TreeComponent, TreeNode } from '../tree';
import { PopoverComponent, PopoverContentComponent, PopoverTriggerComponent } from '../popover';
import { TreeSelectTriggerComponent } from './sub/tree-select-trigger.component';
import { TreeSelectContentComponent } from './sub/tree-select-content.component';

export const TREE_SELECT = new InjectionToken<TreeSelectComponent>('TREE_SELECT');

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
  templateUrl: './tree-select.component.html',
  styleUrl: './tree-select.component.css',
})
export class TreeSelectComponent implements ControlValueAccessor {
  nodes = input<TreeNode[]>([]);
  /** Override for the placeholder. Falls back to the locale's `selectPlaceholder`. */
  placeholder = input<string>();
  disabled = input(false);
  class = input('');
  value = input<string | null | undefined>(undefined);

  /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
  readonly locale = input<LocaleInput<CommonLocale>>();
  private readonly i18n = createLocaleBindings(this.locale, COMMON_LOCALES);
  protected readonly t = this.i18n.t;
  protected readonly dir = this.i18n.dir;

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

  onSelectionChange(selection: string[]): void {
    const newVal = selection[0] ?? null;
    this.internalValue.set(newVal);
    this.onChange(newVal);
    this.selectionChange.emit(selection);
    this.isOpen.set(false);
  }

  select(value: string | null): void {
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
