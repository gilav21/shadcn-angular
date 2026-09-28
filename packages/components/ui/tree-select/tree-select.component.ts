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
  inject,
  isSignal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn } from '../../lib/utils';
import { createLocaleBindings, type LocaleInput } from '../../lib/i18n';
import { COMMON_LOCALES, type CommonLocale } from '../../lib/i18n/common.locales';
import { TreeComponent, TreeNode } from '../tree';
import { POPOVER, PopoverComponent, PopoverContentComponent, PopoverTriggerComponent } from '../popover';
import { TreeSelectTriggerComponent } from './sub/tree-select-trigger.component';
import { TreeSelectContentComponent } from './sub/tree-select-content.component';

export const TREE_SELECT = new InjectionToken<TreeSelectComponent>('TREE_SELECT');

/**
 * A POPOVER that forwards every access to the popover `resolve` returns at the
 * moment of use. Content projected into `ui-tree-select` is created — and
 * injects POPOVER — before tree-select's own view, so the inner `<ui-popover>`
 * does not exist yet when it asks.
 */
function lazyPopover(resolve: () => PopoverComponent | undefined): PopoverComponent {
  const shell: PopoverComponent = Object.create(PopoverComponent.prototype);
  return new Proxy(shell, {
    get(target, prop) {
      const popover = resolve();
      // Before the view exists only introspection (dev-mode injector profiling) reads it.
      if (!popover) return Reflect.get(target, prop);
      const value: unknown = Reflect.get(popover, prop);
      // Methods need their receiver; a signal must pass through untouched, since a bound copy loses `.set`.
      return typeof value === 'function' && !isSignal(value) ? value.bind(popover) : value;
    },
  });
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
    {
      provide: POPOVER,
      useFactory: (): PopoverComponent => {
        const treeSelect = inject(TreeSelectComponent);
        return lazyPopover(() => treeSelect.popover());
      },
    },
  ],
  host: { '(focusout)': 'onFocusOut()' },
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
  /**
   * Tree data for the built-in popover. Passing a non-empty array switches the
   * component into data-driven mode: it renders its own combobox trigger and a
   * single-select `ui-tree` in the popover. Leave it empty to fall back to
   * projected content: a `<ui-popover-trigger>` and a `<ui-popover-content>`
   * (optionally wrapped in {@link TreeSelectTriggerComponent} /
   * {@link TreeSelectContentComponent}) drive this component's popover, and you
   * drive the selection yourself via {@link select}.
   */
  nodes = input<TreeNode[]>([]);
  /** Override for the placeholder. Falls back to the locale's `selectPlaceholder`. */
  placeholder = input<string>();
  /**
   * Disables the built-in trigger. OR-ed with the forms-driven disabled flag
   * from {@link setDisabledState}, so a reactive-forms `disable()` still wins
   * when this is `false` — see {@link isDisabled}.
   */
  disabled = input(false);
  /** Extra classes merged onto the built-in combobox trigger button (data-driven mode only). */
  class = input('');
  /**
   * Selected node key for uncontrolled/standalone use. Any value other than
   * `undefined` (including `null`, which clears the selection) is pushed into
   * the internal state whenever it changes. It does not re-assert itself after
   * a user pick, so a static value will not block selection. Prefer
   * `ngModel`/`formControl` over this input — do not use both.
   */
  value = input<string | null | undefined>(undefined);

  /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
  readonly locale = input<LocaleInput<CommonLocale>>();
  private readonly i18n = createLocaleBindings(this.locale, COMMON_LOCALES);
  protected readonly t = this.i18n.t;
  protected readonly dir = this.i18n.dir;

  /**
   * Emits the selected node keys after every pick. Selection is single, so the
   * array holds at most one key and is empty when the selection is cleared —
   * it is an array only to mirror `ui-tree`'s output. Emitted by both
   * {@link onSelectionChange} and {@link select}, each of which also closes the
   * popover. Not emitted for values arriving via {@link value} or
   * {@link writeValue}.
   */
  selectionChange = output<string[]>();

  customTrigger = contentChild(TreeSelectTriggerComponent);
  customContent = contentChild(TreeSelectContentComponent);

  internalValue = signal<string | null>(null);
  isOpen = signal(false);

  tree = viewChild(TreeComponent);
  /** The popover in this component's view. Both modes open it; projected triggers and content reach it through POPOVER. */
  readonly popover = viewChild(PopoverComponent);

  isDataDriven = computed(() => this.nodes().length > 0);

  selectedNode = computed(() => {
    const val = this.internalValue();
    if (!val) return null;
    return this.findNode(this.nodes(), val);
  });

  triggerClasses = computed(() => cn(
    'flex w-full items-center justify-between rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
    this.class()
  ));

  isDisabled = computed(() => this.disabled() || this.formDisabled());

  private readonly formDisabled = signal(false);
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

  /**
   * Called by Angular forms, not by consumers. The control value is a node
   * `key` (a `string`), never the {@link TreeNode} object — the node is looked
   * up in {@link nodes} by key to render the trigger label, so a key with no
   * matching node shows the placeholder. Does not emit
   * {@link selectionChange}.
   */
  writeValue(value: string | null): void {
    this.internalValue.set(value);
  }

  /** Called by Angular forms, not by consumers. The registered callback receives the node key, or `null` when cleared. */
  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  /**
   * Called by Angular forms, not by consumers. The control is marked touched
   * when the user leaves it: when the popover closes (dismissed or after a
   * pick), or when focus leaves the control while the popover is closed.
   */
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /**
   * Called by Angular forms, not by consumers. Only disables the built-in
   * trigger button (OR-ed with the {@link disabled} input); it does not close
   * an already-open popover, and it does not disable a projected custom
   * trigger.
   */
  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }

  /**
   * Template handler for the inner `ui-tree`'s selection output. Takes the
   * first key as the new value (empty selection clears it), notifies the form
   * control, re-emits {@link selectionChange}, and closes the popover. Call
   * {@link select} instead from custom-content mode.
   */
  onSelectionChange(selection: string[]): void {
    const newVal = selection[0] ?? null;
    this.internalValue.set(newVal);
    this.onChange(newVal);
    this.selectionChange.emit(selection);
    this.closePopover();
  }

  /**
   * Selects a node by key from projected custom content — inject
   * {@link TREE_SELECT} in your own trigger/content to reach it. Updates the
   * form control, emits {@link selectionChange} (`[value]`, or `[]` when
   * `null`), and closes the popover. Bypasses {@link disabled}: guard the call
   * yourself if the control may be disabled.
   */
  select(value: string | null): void {
    this.internalValue.set(value);
    this.onChange(value);
    this.selectionChange.emit(value ? [value] : []);
    this.closePopover();
  }

  /** Template handler for the popover's own open/close (trigger, outside click, Escape). */
  onOpenChange(open: boolean): void {
    if (open) {
      this.isOpen.set(true);
      return;
    }
    this.closePopover();
  }

  /**
   * Host `focusout` handler: blurring the closed control marks it touched.
   * While the popover is open focus moves into the panel, which is not
   * leaving — closing the popover marks the control touched instead.
   */
  onFocusOut(): void {
    if (this.isOpen()) return;
    this.onTouched();
  }

  private closePopover(): void {
    this.isOpen.set(false);
    this.onTouched();
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
