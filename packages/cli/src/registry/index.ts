// Component Registry - Contains all available component definitions
// Each component has files (content) and dependencies on other components

export interface ComponentFile {
  name: string;
  content: string;
}

export interface ComponentDefinition {
  name: string;
  files: ComponentFile[];
  dependencies?: string[];
}

export type ComponentName = keyof typeof registry;

// =============================================================================
// BUTTON COMPONENT
// =============================================================================

const buttonComponent: ComponentDefinition = {
  name: 'button',
  files: [
    {
      name: 'button/button.component.ts',
      content: `import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
} from '@angular/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive rounded-lg border border-transparent text-sm font-medium focus-visible:ring-[3px] aria-invalid:ring-[3px] inline-flex items-center justify-center whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 shrink-0 outline-none select-none cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive/10 hover:bg-destructive/20 text-destructive focus-visible:ring-destructive/20',
        outline: 'border-input bg-background hover:bg-muted hover:text-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-muted hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
        'icon-sm': 'h-8 w-8',
        'icon-lg': 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
export type ButtonSize = VariantProps<typeof buttonVariants>['size'];

@Component({
  selector: 'ui-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    <button
      [class]="classes()"
      [disabled]="disabled()"
      [type]="type()"
      [attr.data-slot]="'button'"
    >
      <ng-content />
    </button>
  \`,
  host: {
    '[class]': '"contents"',
  },
})
export class ButtonComponent {
  // Inputs
  variant = input<ButtonVariant>('default');
  size = input<ButtonSize>('default');
  disabled = input(false);
  type = input<'button' | 'submit' | 'reset'>('button');
  class = input('');

  // Outputs
  clicked = output<MouseEvent>();

  // Computed
  classes = computed(() =>
    cn(buttonVariants({ variant: this.variant(), size: this.size() }), this.class())
  );
}

export { buttonVariants };
`,
    },
    {
      name: 'button/index.ts',
      content: `export * from './button.component';
`,
    },
  ],
  dependencies: [],
};

// =============================================================================
// INPUT COMPONENT
// =============================================================================

const inputComponent: ComponentDefinition = {
  name: 'input',
  files: [
    {
      name: 'input/input.component.ts',
      content: `import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  forwardRef,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { cn } from '../../lib/utils';

@Component({
  selector: 'ui-input',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true,
    },
  ],
  template: \`
    <input
      [class]="classes()"
      [type]="type()"
      [disabled]="disabled()"
      [placeholder]="placeholder()"
      [attr.data-slot]="'input'"
      [ngModel]="value()"
      (ngModelChange)="onValueChange($event)"
      (blur)="onTouched()"
    />
  \`,
  host: {
    '[class]': '"contents"',
  },
})
export class InputComponent implements ControlValueAccessor {
  // Inputs
  type = input<string>('text');
  placeholder = input<string>('');
  disabled = input(false);
  class = input('');

  // State
  value = signal('');

  // CVA callbacks
  private onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  // Computed
  classes = computed(() =>
    cn(
      'dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive h-9 rounded-lg border bg-transparent px-3 py-1 text-base transition-colors focus-visible:ring-[3px] aria-invalid:ring-[3px] md:text-sm placeholder:text-muted-foreground w-full min-w-0 outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
      this.class()
    )
  );

  onValueChange(value: string) {
    this.value.set(value);
    this.onChange(value);
  }

  // ControlValueAccessor
  writeValue(value: string): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    // Handled by input signal
  }
}
`,
    },
    {
      name: 'input/index.ts',
      content: `export * from './input.component';
`,
    },
  ],
  dependencies: [],
};

// =============================================================================
// LABEL COMPONENT
// =============================================================================

const labelComponent: ComponentDefinition = {
  name: 'label',
  files: [
    {
      name: 'label/label.component.ts',
      content: `import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

@Component({
  selector: 'ui-label',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    <label [class]="classes()" [attr.for]="for()" [attr.data-slot]="'label'">
      <ng-content />
    </label>
  \`,
  host: {
    '[class]': '"contents"',
  },
})
export class LabelComponent {
  for = input<string>('');
  class = input('');

  classes = computed(() =>
    cn(
      'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      this.class()
    )
  );
}
`,
    },
    {
      name: 'label/index.ts',
      content: `export * from './label.component';
`,
    },
  ],
  dependencies: [],
};

// =============================================================================
// BADGE COMPONENT
// =============================================================================

const badgeComponent: ComponentDefinition = {
  name: 'badge',
  files: [
    {
      name: 'badge/badge.component.ts',
      content: `import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];

@Component({
  selector: 'ui-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    <span [class]="classes()" [attr.data-slot]="'badge'">
      <ng-content />
    </span>
  \`,
  host: {
    '[class]': '"contents"',
  },
})
export class BadgeComponent {
  variant = input<BadgeVariant>('default');
  class = input('');

  classes = computed(() =>
    cn(badgeVariants({ variant: this.variant() }), this.class())
  );
}

export { badgeVariants };
`,
    },
    {
      name: 'badge/index.ts',
      content: `export * from './badge.component';
`,
    },
  ],
  dependencies: [],
};

// =============================================================================
// CARD COMPONENT
// =============================================================================

const cardComponent: ComponentDefinition = {
  name: 'card',
  files: [
    {
      name: 'card/card.component.ts',
      content: `import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

@Component({
  selector: 'ui-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`<ng-content />\`,
  host: {
    '[class]': 'classes()',
    '[attr.data-slot]': '"card"',
  },
})
export class CardComponent {
  class = input('');

  classes = computed(() =>
    cn(
      'bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm',
      this.class()
    )
  );
}

@Component({
  selector: 'ui-card-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`<ng-content />\`,
  host: {
    '[class]': 'classes()',
    '[attr.data-slot]': '"card-header"',
  },
})
export class CardHeaderComponent {
  class = input('');

  classes = computed(() =>
    cn(
      '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6',
      this.class()
    )
  );
}

@Component({
  selector: 'ui-card-title',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`<ng-content />\`,
  host: {
    '[class]': 'classes()',
    '[attr.data-slot]': '"card-title"',
  },
})
export class CardTitleComponent {
  class = input('');

  classes = computed(() =>
    cn('leading-none font-semibold', this.class())
  );
}

@Component({
  selector: 'ui-card-description',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`<ng-content />\`,
  host: {
    '[class]': 'classes()',
    '[attr.data-slot]': '"card-description"',
  },
})
export class CardDescriptionComponent {
  class = input('');

  classes = computed(() =>
    cn('text-muted-foreground text-sm', this.class())
  );
}

@Component({
  selector: 'ui-card-action',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`<ng-content />\`,
  host: {
    '[class]': 'classes()',
    '[attr.data-slot]': '"card-action"',
  },
})
export class CardActionComponent {
  class = input('');

  classes = computed(() =>
    cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', this.class())
  );
}

@Component({
  selector: 'ui-card-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`<ng-content />\`,
  host: {
    '[class]': 'classes()',
    '[attr.data-slot]': '"card-content"',
  },
})
export class CardContentComponent {
  class = input('');

  classes = computed(() => cn('px-6', this.class()));
}

@Component({
  selector: 'ui-card-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`<ng-content />\`,
  host: {
    '[class]': 'classes()',
    '[attr.data-slot]': '"card-footer"',
  },
})
export class CardFooterComponent {
  class = input('');

  classes = computed(() =>
    cn('flex items-center px-6 [.border-t]:pt-6', this.class())
  );
}
`,
    },
    {
      name: 'card/index.ts',
      content: `export * from './card.component';
`,
    },
  ],
  dependencies: [],
};

// =============================================================================
// SEPARATOR COMPONENT
// =============================================================================

const separatorComponent: ComponentDefinition = {
  name: 'separator',
  files: [
    {
      name: 'separator/separator.component.ts',
      content: `import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

@Component({
  selector: 'ui-separator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`\`,
  host: {
    '[class]': 'classes()',
    '[attr.data-slot]': '"separator"',
    '[attr.role]': '"separator"',
    '[attr.aria-orientation]': 'orientation()',
  },
})
export class SeparatorComponent {
  orientation = input<'horizontal' | 'vertical'>('horizontal');
  class = input('');

  classes = computed(() =>
    cn(
      'bg-border shrink-0',
      this.orientation() === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
      this.class()
    )
  );
}
`,
    },
    {
      name: 'separator/index.ts',
      content: `export * from './separator.component';
`,
    },
  ],
  dependencies: [],
};

// =============================================================================
// TEXTAREA COMPONENT
// =============================================================================

const textareaComponent: ComponentDefinition = {
  name: 'textarea',
  files: [
    {
      name: 'textarea/textarea.component.ts',
      content: `import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  forwardRef,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { cn } from '../../lib/utils';

@Component({
  selector: 'ui-textarea',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextareaComponent),
      multi: true,
    },
  ],
  template: \`
    <textarea
      [class]="classes()"
      [disabled]="disabled()"
      [placeholder]="placeholder()"
      [rows]="rows()"
      [attr.data-slot]="'textarea'"
      [ngModel]="value()"
      (ngModelChange)="onValueChange($event)"
      (blur)="onTouched()"
    ></textarea>
  \`,
  host: {
    '[class]': '"contents"',
  },
})
export class TextareaComponent implements ControlValueAccessor {
  placeholder = input<string>('');
  disabled = input(false);
  rows = input(3);
  class = input('');

  value = signal('');

  private onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  classes = computed(() =>
    cn(
      'dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive rounded-lg border bg-transparent px-3 py-2 text-base transition-colors focus-visible:ring-[3px] aria-invalid:ring-[3px] md:text-sm placeholder:text-muted-foreground w-full min-w-0 outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 resize-none',
      this.class()
    )
  );

  onValueChange(value: string) {
    this.value.set(value);
    this.onChange(value);
  }

  writeValue(value: string): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {}
}
`,
    },
    {
      name: 'textarea/index.ts',
      content: `export * from './textarea.component';
`,
    },
  ],
  dependencies: [],
};

// =============================================================================
// SKELETON COMPONENT
// =============================================================================

const skeletonComponent: ComponentDefinition = {
  name: 'skeleton',
  files: [
    {
      name: 'skeleton/skeleton.component.ts',
      content: `import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

@Component({
  selector: 'ui-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`\`,
  host: {
    '[class]': 'classes()',
    '[attr.data-slot]': '"skeleton"',
  },
})
export class SkeletonComponent {
  class = input('');

  classes = computed(() =>
    cn('animate-pulse rounded-md bg-muted', this.class())
  );
}
`,
    },
    {
      name: 'skeleton/index.ts',
      content: `export * from './skeleton.component';
`,
    },
  ],
  dependencies: [],
};

// =============================================================================
// SPINNER COMPONENT
// =============================================================================

const spinnerComponent: ComponentDefinition = {
  name: 'spinner',
  files: [
    {
      name: 'spinner/spinner.component.ts',
      content: `import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

@Component({
  selector: 'ui-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    <svg
      [class]="classes()"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      [attr.data-slot]="'spinner'"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      ></circle>
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  \`,
  host: {
    '[class]': '"contents"',
  },
})
export class SpinnerComponent {
  size = input<'sm' | 'default' | 'lg'>('default');
  class = input('');

  classes = computed(() =>
    cn(
      'animate-spin text-muted-foreground',
      {
        'h-4 w-4': this.size() === 'sm',
        'h-6 w-6': this.size() === 'default',
        'h-8 w-8': this.size() === 'lg',
      },
      this.class()
    )
  );
}
`,
    },
    {
      name: 'spinner/index.ts',
      content: `export * from './spinner.component';
`,
    },
  ],
  dependencies: [],
};

// =============================================================================
// CHECKBOX COMPONENT
// =============================================================================

const checkboxComponent: ComponentDefinition = {
  name: 'checkbox',
  files: [
    {
      name: 'checkbox/checkbox.component.ts',
      content: `import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  forwardRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn } from '../../lib/utils';

@Component({
  selector: 'ui-checkbox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxComponent),
      multi: true,
    },
  ],
  template: \`
    <button
      type="button"
      role="checkbox"
      [attr.aria-checked]="checked()"
      [class]="classes()"
      [disabled]="disabled()"
      [attr.data-slot]="'checkbox'"
      (click)="toggle()"
    >
      @if (checked()) {
        <svg
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="3"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      }
    </button>
  \`,
  host: {
    '[class]': '"contents"',
  },
})
export class CheckboxComponent implements ControlValueAccessor {
  disabled = input(false);
  class = input('');

  checked = signal(false);
  checkedChange = output<boolean>();

  private onChange: (value: boolean) => void = () => {};
  private onTouched: () => void = () => {};

  classes = computed(() =>
    cn(
      'peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
      this.checked() && 'bg-primary text-primary-foreground',
      this.class()
    )
  );

  toggle() {
    if (this.disabled()) return;
    const newValue = !this.checked();
    this.checked.set(newValue);
    this.onChange(newValue);
    this.checkedChange.emit(newValue);
    this.onTouched();
  }

  writeValue(value: boolean): void {
    this.checked.set(value ?? false);
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {}
}
`,
    },
    {
      name: 'checkbox/index.ts',
      content: `export * from './checkbox.component';
`,
    },
  ],
  dependencies: [],
};

// =============================================================================
// SWITCH COMPONENT
// =============================================================================

const switchComponent: ComponentDefinition = {
  name: 'switch',
  files: [
    {
      name: 'switch/switch.component.ts',
      content: `import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  forwardRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn } from '../../lib/utils';

@Component({
  selector: 'ui-switch',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SwitchComponent),
      multi: true,
    },
  ],
  template: \`
    <button
      type="button"
      role="switch"
      [attr.aria-checked]="checked()"
      [class]="trackClasses()"
      [disabled]="disabled()"
      [attr.data-slot]="'switch'"
      (click)="toggle()"
    >
      <span [class]="thumbClasses()"></span>
    </button>
  \`,
  host: {
    '[class]': '"contents"',
  },
})
export class SwitchComponent implements ControlValueAccessor {
  disabled = input(false);
  class = input('');

  checked = signal(false);
  checkedChange = output<boolean>();

  private onChange: (value: boolean) => void = () => {};
  private onTouched: () => void = () => {};

  trackClasses = computed(() =>
    cn(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
      this.checked() ? 'bg-primary' : 'bg-input',
      this.class()
    )
  );

  thumbClasses = computed(() =>
    cn(
      'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
      this.checked() ? 'translate-x-4' : 'translate-x-0'
    )
  );

  toggle() {
    if (this.disabled()) return;
    const newValue = !this.checked();
    this.checked.set(newValue);
    this.onChange(newValue);
    this.checkedChange.emit(newValue);
    this.onTouched();
  }

  writeValue(value: boolean): void {
    this.checked.set(value ?? false);
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {}
}
`,
    },
    {
      name: 'switch/index.ts',
      content: `export * from './switch.component';
`,
    },
  ],
  dependencies: [],
};

// =============================================================================
// AVATAR COMPONENT
// =============================================================================

const avatarComponent: ComponentDefinition = {
  name: 'avatar',
  files: [
    {
      name: 'avatar/avatar.component.ts',
      content: `import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
} from '@angular/core';
import { cn } from '../../lib/utils';

@Component({
  selector: 'ui-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`<ng-content />\`,
  host: {
    '[class]': 'classes()',
    '[attr.data-slot]': '"avatar"',
  },
})
export class AvatarComponent {
  class = input('');

  classes = computed(() =>
    cn(
      'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
      this.class()
    )
  );
}

@Component({
  selector: 'ui-avatar-image',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    @if (!error()) {
      <img
        [class]="classes()"
        [src]="src()"
        [alt]="alt()"
        (error)="onError()"
        [attr.data-slot]="'avatar-image'"
      />
    }
  \`,
  host: {
    '[class]': '"contents"',
  },
})
export class AvatarImageComponent {
  src = input.required<string>();
  alt = input('');
  class = input('');

  error = signal(false);

  classes = computed(() =>
    cn('aspect-square h-full w-full object-cover', this.class())
  );

  onError() {
    this.error.set(true);
  }
}

@Component({
  selector: 'ui-avatar-fallback',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`<ng-content />\`,
  host: {
    '[class]': 'classes()',
    '[attr.data-slot]': '"avatar-fallback"',
  },
})
export class AvatarFallbackComponent {
  class = input('');

  classes = computed(() =>
    cn(
      'flex h-full w-full items-center justify-center rounded-full bg-muted',
      this.class()
    )
  );
}
`,
    },
    {
      name: 'avatar/index.ts',
      content: `export * from './avatar.component';
`,
    },
  ],
  dependencies: [],
};

// =============================================================================
// ALERT COMPONENT
// =============================================================================

const alertComponent: ComponentDefinition = {
  name: 'alert',
  files: [
    {
      name: 'alert/alert.component.ts',
      content: `import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const alertVariants = cva(
  'relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        destructive:
          'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export type AlertVariant = VariantProps<typeof alertVariants>['variant'];

@Component({
  selector: 'ui-alert',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`<ng-content />\`,
  host: {
    '[class]': 'classes()',
    '[attr.role]': '"alert"',
    '[attr.data-slot]': '"alert"',
  },
})
export class AlertComponent {
  variant = input<AlertVariant>('default');
  class = input('');

  classes = computed(() =>
    cn(alertVariants({ variant: this.variant() }), this.class())
  );
}

@Component({
  selector: 'ui-alert-title',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`<ng-content />\`,
  host: {
    '[class]': 'classes()',
    '[attr.data-slot]': '"alert-title"',
  },
})
export class AlertTitleComponent {
  class = input('');

  classes = computed(() =>
    cn('mb-1 font-medium leading-none tracking-tight', this.class())
  );
}

@Component({
  selector: 'ui-alert-description',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`<ng-content />\`,
  host: {
    '[class]': 'classes()',
    '[attr.data-slot]': '"alert-description"',
  },
})
export class AlertDescriptionComponent {
  class = input('');

  classes = computed(() =>
    cn('text-sm [&_p]:leading-relaxed', this.class())
  );
}

export { alertVariants };
`,
    },
    {
      name: 'alert/index.ts',
      content: `export * from './alert.component';
`,
    },
  ],
  dependencies: [],
};

// =============================================================================
// PROGRESS COMPONENT
// =============================================================================

const progressComponent: ComponentDefinition = {
  name: 'progress',
  files: [
    {
      name: 'progress/progress.component.ts',
      content: `import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

@Component({
  selector: 'ui-progress',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    <div
      role="progressbar"
      [attr.aria-valuenow]="value()"
      [attr.aria-valuemin]="0"
      [attr.aria-valuemax]="max()"
      [class]="classes()"
      [attr.data-slot]="'progress'"
    >
      <div
        class="h-full bg-primary transition-all rounded-full"
        [style.width.%]="percentage()"
      ></div>
    </div>
  \`,
  host: { class: 'block' },
})
export class ProgressComponent {
  value = input(0);
  max = input(100);
  class = input('');

  percentage = computed(() => {
    const val = this.value();
    const maxVal = this.max();
    return Math.min(100, Math.max(0, (val / maxVal) * 100));
  });

  classes = computed(() =>
    cn(
      'relative h-2 w-full overflow-hidden rounded-full bg-primary/20',
      this.class()
    )
  );
}
`,
    },
    {
      name: 'progress/index.ts',
      content: `export * from './progress.component';
`,
    },
  ],
  dependencies: [],
};

// =============================================================================
// RADIO GROUP COMPONENT
// =============================================================================

const radioGroupComponent: ComponentDefinition = {
  name: 'radio-group',
  files: [
    {
      name: 'radio-group/radio-group.component.ts',
      content: `import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  forwardRef,
  inject,
  InjectionToken,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn } from '../../lib/utils';

export const RADIO_GROUP = new InjectionToken<RadioGroupComponent>('RADIO_GROUP');

@Component({
  selector: 'ui-radio-group',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RadioGroupComponent),
      multi: true,
    },
    {
      provide: RADIO_GROUP,
      useExisting: RadioGroupComponent,
    },
  ],
  template: \`
    <div
      role="radiogroup"
      [attr.aria-orientation]="orientation()"
      [class]="classes()"
      [attr.data-slot]="'radio-group'"
    >
      <ng-content />
    </div>
  \`,
  host: {
    '[class]': '"contents"',
  },
})
export class RadioGroupComponent implements ControlValueAccessor {
  orientation = input<'horizontal' | 'vertical'>('vertical');
  disabled = input(false);
  class = input('');

  value = signal<string | null>(null);
  valueChange = output<string>();

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  classes = computed(() =>
    cn(
      'grid gap-2',
      this.orientation() === 'horizontal' ? 'grid-flow-col' : 'grid-flow-row',
      this.class()
    )
  );

  selectValue(val: string) {
    if (this.disabled()) return;
    this.value.set(val);
    this.onChange(val);
    this.valueChange.emit(val);
    this.onTouched();
  }

  writeValue(value: string): void {
    this.value.set(value);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {}
}

@Component({
  selector: 'ui-radio-group-item',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    <button
      type="button"
      role="radio"
      [attr.aria-checked]="isSelected()"
      [attr.data-state]="isSelected() ? 'checked' : 'unchecked'"
      [class]="classes()"
      [disabled]="disabled()"
      [attr.data-slot]="'radio-group-item'"
      (click)="select()"
    >
      @if (isSelected()) {
        <span class="flex items-center justify-center">
          <span class="h-2.5 w-2.5 rounded-full bg-current"></span>
        </span>
      }
    </button>
  \`,
  host: {
    '[class]': '"contents"',
  },
})
export class RadioGroupItemComponent {
  value = input.required<string>();
  disabled = input(false);
  class = input('');

  private group = inject(RADIO_GROUP, { optional: true });

  isSelected = computed(() => this.group?.value() === this.value());

  classes = computed(() =>
    cn(
      'aspect-square h-4 w-4 rounded-full border border-primary text-primary shadow focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center',
      this.isSelected() ? 'border-primary' : 'bg-background',
      this.class()
    )
  );

  select() {
    if (this.disabled() || !this.group) return;
    this.group.selectValue(this.value());
  }
}
`,
    },
    {
      name: 'radio-group/index.ts',
      content: `export * from './radio-group.component';
`,
    },
  ],
  dependencies: [],
};

// =============================================================================
// TABS COMPONENT
// =============================================================================

const tabsComponent: ComponentDefinition = {
  name: 'tabs',
  files: [
    {
      name: 'tabs/tabs.component.ts',
      content: `import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  inject,
  InjectionToken,
} from '@angular/core';
import { cn } from '../../lib/utils';

export const TABS = new InjectionToken<TabsComponent>('TABS');

@Component({
  selector: 'ui-tabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: TABS, useExisting: TabsComponent }],
  template: \`
    <div [class]="classes()" [attr.data-slot]="'tabs'">
      <ng-content />
    </div>
  \`,
  host: { '[class]': '"contents"' },
})
export class TabsComponent {
  defaultValue = input<string>('');
  class = input('');

  activeTab = signal<string>('');
  tabChange = output<string>();

  classes = computed(() => cn('w-full', this.class()));

  ngOnInit() {
    if (this.defaultValue()) {
      this.activeTab.set(this.defaultValue());
    }
  }

  selectTab(value: string) {
    this.activeTab.set(value);
    this.tabChange.emit(value);
  }
}

@Component({
  selector: 'ui-tabs-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    <div
      role="tablist"
      [class]="classes()"
      [attr.data-slot]="'tabs-list'"
    >
      <ng-content />
    </div>
  \`,
  host: { '[class]': '"contents"' },
})
export class TabsListComponent {
  class = input('');

  classes = computed(() =>
    cn(
      'inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
      this.class()
    )
  );
}

@Component({
  selector: 'ui-tabs-trigger',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    <button
      type="button"
      role="tab"
      [attr.aria-selected]="isActive()"
      [attr.data-state]="isActive() ? 'active' : 'inactive'"
      [class]="classes()"
      [attr.data-slot]="'tabs-trigger'"
      (click)="select()"
    >
      <ng-content />
    </button>
  \`,
  host: { '[class]': '"contents"' },
})
export class TabsTriggerComponent {
  value = input.required<string>();
  class = input('');

  private tabs = inject(TABS, { optional: true });

  isActive = computed(() => this.tabs?.activeTab() === this.value());

  classes = computed(() =>
    cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
      this.isActive()
        ? 'bg-background text-foreground shadow'
        : 'hover:bg-background/50',
      this.class()
    )
  );

  select() {
    if (this.tabs) {
      this.tabs.selectTab(this.value());
    }
  }
}

@Component({
  selector: 'ui-tabs-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    @if (isActive()) {
      <div
        role="tabpanel"
        [class]="classes()"
        [attr.data-slot]="'tabs-content'"
      >
        <ng-content />
      </div>
    }
  \`,
  host: { '[class]': '"contents"' },
})
export class TabsContentComponent {
  value = input.required<string>();
  class = input('');

  private tabs = inject(TABS, { optional: true });

  isActive = computed(() => this.tabs?.activeTab() === this.value());

  classes = computed(() =>
    cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      this.class()
    )
  );
}
`,
    },
    {
      name: 'tabs/index.ts',
      content: `export * from './tabs.component';
`,
    },
  ],
  dependencies: [],
};

// =============================================================================
// ACCORDION COMPONENT
// =============================================================================

const accordionComponent: ComponentDefinition = {
  name: 'accordion',
  files: [
    {
      name: 'accordion/accordion.component.ts',
      content: `import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
  inject,
  InjectionToken,
} from '@angular/core';
import { cn } from '../../lib/utils';

export const ACCORDION = new InjectionToken<AccordionComponent>('ACCORDION');

@Component({
  selector: 'ui-accordion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: ACCORDION, useExisting: AccordionComponent }],
  template: \`
    <div [class]="classes()" [attr.data-slot]="'accordion'">
      <ng-content />
    </div>
  \`,
  host: { '[class]': '"contents"' },
})
export class AccordionComponent {
  type = input<'single' | 'multiple'>('single');
  class = input('');

  openItems = signal<Set<string>>(new Set());

  classes = computed(() => cn('w-full', this.class()));

  toggle(value: string) {
    const current = this.openItems();
    if (this.type() === 'single') {
      if (current.has(value)) {
        this.openItems.set(new Set());
      } else {
        this.openItems.set(new Set([value]));
      }
    } else {
      const next = new Set(current);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      this.openItems.set(next);
    }
  }

  isOpen(value: string): boolean {
    return this.openItems().has(value);
  }
}

@Component({
  selector: 'ui-accordion-item',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    <div [class]="classes()" [attr.data-slot]="'accordion-item'">
      <ng-content />
    </div>
  \`,
  host: { '[class]': '"contents"' },
})
export class AccordionItemComponent {
  value = input.required<string>();
  class = input('');

  classes = computed(() => cn('border-b', this.class()));
}

@Component({
  selector: 'ui-accordion-trigger',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    <h3 class="flex">
      <button
        type="button"
        [class]="classes()"
        [attr.aria-expanded]="isOpen()"
        [attr.data-state]="isOpen() ? 'open' : 'closed'"
        [attr.data-slot]="'accordion-trigger'"
        (click)="toggle()"
      >
        <ng-content />
        <svg
          class="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
          [class.rotate-180]="isOpen()"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </h3>
  \`,
  host: { '[class]': '"contents"' },
})
export class AccordionTriggerComponent {
  class = input('');

  private accordion = inject(ACCORDION, { optional: true });
  private item = inject(AccordionItemComponent, { optional: true });

  isOpen = computed(() => {
    const val = this.item?.value();
    return val ? this.accordion?.isOpen(val) ?? false : false;
  });

  classes = computed(() =>
    cn(
      'flex flex-1 items-center justify-between py-4 text-sm font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180',
      this.class()
    )
  );

  toggle() {
    const val = this.item?.value();
    if (val && this.accordion) {
      this.accordion.toggle(val);
    }
  }
}

@Component({
  selector: 'ui-accordion-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    @if (isOpen()) {
      <div
        [class]="classes()"
        [attr.data-state]="isOpen() ? 'open' : 'closed'"
        [attr.data-slot]="'accordion-content'"
      >
        <div class="pb-4 pt-0">
          <ng-content />
        </div>
      </div>
    }
  \`,
  host: { '[class]': '"contents"' },
})
export class AccordionContentComponent {
  class = input('');

  private accordion = inject(ACCORDION, { optional: true });
  private item = inject(AccordionItemComponent, { optional: true });

  isOpen = computed(() => {
    const val = this.item?.value();
    return val ? this.accordion?.isOpen(val) ?? false : false;
  });

  classes = computed(() =>
    cn('overflow-hidden text-sm', this.class())
  );
}
`,
    },
    {
      name: 'accordion/index.ts',
      content: `export * from './accordion.component';
`,
    },
  ],
  dependencies: [],
};

// =============================================================================
// DIALOG COMPONENT
// =============================================================================

const dialogComponent: ComponentDefinition = {
  name: 'dialog',
  files: [
    {
      name: 'dialog/dialog.component.ts',
      content: `import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  inject,
} from '@angular/core';
import { cn } from '../../lib/utils';

@Component({
  selector: 'ui-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`<ng-content />\`,
  host: { class: 'contents' },
})
export class DialogComponent {
  open = signal(false);
  openChange = output<boolean>();

  show() {
    this.open.set(true);
    this.openChange.emit(true);
  }

  hide() {
    this.open.set(false);
    this.openChange.emit(false);
  }

  toggle() {
    const newState = !this.open();
    this.open.set(newState);
    this.openChange.emit(newState);
  }
}

@Component({
  selector: 'ui-dialog-trigger',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    <span (click)="onClick()" [attr.data-slot]="'dialog-trigger'">
      <ng-content />
    </span>
  \`,
  host: { class: 'contents' },
})
export class DialogTriggerComponent {
  private dialog = inject(DialogComponent, { optional: true });

  onClick() {
    this.dialog?.toggle();
  }
}

@Component({
  selector: 'ui-dialog-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    @if (dialog?.open()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center">
        <!-- Overlay -->
        <div
          class="fixed inset-0 bg-black/80 animate-in fade-in-0"
          (click)="onOverlayClick()"
        ></div>
        <!-- Content -->
        <div
          [class]="classes()"
          [attr.data-slot]="'dialog-content'"
        >
          <ng-content />
          <!-- Close button -->
          <button
            type="button"
            class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            (click)="close()"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span class="sr-only">Close</span>
          </button>
        </div>
      </div>
    }
  \`,
  host: { class: 'contents' },
})
export class DialogContentComponent {
  dialog = inject(DialogComponent, { optional: true });
  class = input('');

  classes = computed(() =>
    cn(
      'fixed z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg',
      this.class()
    )
  );

  onOverlayClick() {
    this.dialog?.hide();
  }

  close() {
    this.dialog?.hide();
  }
}

@Component({
  selector: 'ui-dialog-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`<ng-content />\`,
  host: {
    class: 'flex flex-col space-y-1.5 text-center sm:text-left',
    '[attr.data-slot]': '"dialog-header"',
  },
})
export class DialogHeaderComponent {}

@Component({
  selector: 'ui-dialog-title',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`<ng-content />\`,
  host: {
    class: 'text-lg font-semibold leading-none tracking-tight',
    '[attr.data-slot]': '"dialog-title"',
  },
})
export class DialogTitleComponent {}

@Component({
  selector: 'ui-dialog-description',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`<ng-content />\`,
  host: {
    class: 'text-sm text-muted-foreground',
    '[attr.data-slot]': '"dialog-description"',
  },
})
export class DialogDescriptionComponent {}

@Component({
  selector: 'ui-dialog-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`<ng-content />\`,
  host: {
    class: 'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
    '[attr.data-slot]': '"dialog-footer"',
  },
})
export class DialogFooterComponent {}
`,
    },
    {
      name: 'dialog/index.ts',
      content: `export * from './dialog.component';
`,
    },
  ],
  dependencies: [],
};

// =============================================================================
// DROPDOWN MENU COMPONENT
// =============================================================================

const dropdownMenuComponent: ComponentDefinition = {
  name: 'dropdown-menu',
  files: [
    {
      name: 'dropdown-menu/dropdown-menu.component.ts',
      content: `import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
  inject,
  ElementRef,
  OnDestroy,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cn } from '../../lib/utils';

@Component({
  selector: 'ui-dropdown-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`<ng-content />\`,
  host: { class: 'relative inline-block' },
})
export class DropdownMenuComponent implements OnDestroy {
  private el = inject(ElementRef);
  private document = inject(DOCUMENT);
  open = signal(false);

  private clickListener = (event: MouseEvent) => {
    if (!this.el.nativeElement.contains(event.target)) {
      this.hide();
    }
  };

  constructor() {
    this.document.addEventListener('click', this.clickListener);
  }

  ngOnDestroy() {
    this.document.removeEventListener('click', this.clickListener);
  }

  toggle() {
    this.open.update(v => !v);
  }

  show() {
    this.open.set(true);
  }

  hide() {
    this.open.set(false);
  }
}

@Component({
  selector: 'ui-dropdown-menu-trigger',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    <span (click)="onClick($event)" [attr.data-slot]="'dropdown-trigger'">
      <ng-content />
    </span>
  \`,
  host: { class: 'contents' },
})
export class DropdownMenuTriggerComponent {
  private menu = inject(DropdownMenuComponent, { optional: true });

  onClick(event: MouseEvent) {
    event.stopPropagation();
    this.menu?.toggle();
  }
}

@Component({
  selector: 'ui-dropdown-menu-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    @if (menu?.open()) {
      <div [class]="classes()" [attr.data-slot]="'dropdown-content'">
        <ng-content />
      </div>
    }
  \`,
  host: { class: 'contents' },
})
export class DropdownMenuContentComponent {
  menu = inject(DropdownMenuComponent, { optional: true });
  class = input('');
  align = input<'start' | 'center' | 'end'>('start');

  classes = computed(() => {
    const alignClasses = {
      start: 'left-0',
      center: 'left-1/2 -translate-x-1/2',
      end: 'right-0',
    };
    return cn(
      'absolute top-full z-50 mt-1 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
      alignClasses[this.align()],
      this.class()
    );
  });
}

@Component({
  selector: 'ui-dropdown-menu-item',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`<ng-content />\`,
  host: {
    '[class]': 'classes()',
    '[attr.data-slot]': '"dropdown-item"',
    '(click)': 'onClick()',
  },
})
export class DropdownMenuItemComponent {
  class = input('');
  disabled = input(false);

  private menu = inject(DropdownMenuComponent, { optional: true });

  classes = computed(() =>
    cn(
      'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground',
      this.disabled() && 'pointer-events-none opacity-50',
      this.class()
    )
  );

  onClick() {
    if (!this.disabled()) {
      this.menu?.hide();
    }
  }
}

@Component({
  selector: 'ui-dropdown-menu-separator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`\`,
  host: {
    class: '-mx-1 my-1 h-px bg-border',
    '[attr.data-slot]': '"dropdown-separator"',
  },
})
export class DropdownMenuSeparatorComponent {}

@Component({
  selector: 'ui-dropdown-menu-label',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`<ng-content />\`,
  host: {
    class: 'px-2 py-1.5 text-sm font-semibold',
    '[attr.data-slot]': '"dropdown-label"',
  },
})
export class DropdownMenuLabelComponent {}
`,
    },
    {
      name: 'dropdown-menu/index.ts',
      content: `export * from './dropdown-menu.component';
`,
    },
  ],
  dependencies: [],
};

// =============================================================================
// TOOLTIP COMPONENT
// =============================================================================

const tooltipComponent: ComponentDefinition = {
  name: 'tooltip',
  files: [
    {
      name: 'tooltip/tooltip.component.ts',
      content: `import {
  Component,
  Directive,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
  inject,
  ElementRef,
  OnDestroy,
  Renderer2,
} from '@angular/core';
import { cn } from '../../lib/utils';

@Component({
  selector: 'ui-tooltip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`<ng-content />\`,
  host: { class: 'contents' },
})
export class TooltipComponent {
  open = signal(false);
  content = input<string>('');
  side = input<'top' | 'right' | 'bottom' | 'left'>('top');
  delayDuration = input(200);

  show() {
    this.open.set(true);
  }

  hide() {
    this.open.set(false);
  }
}

@Component({
  selector: 'ui-tooltip-trigger',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    <span
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()"
      (focus)="onFocus()"
      (blur)="onBlur()"
      [attr.data-slot]="'tooltip-trigger'"
    >
      <ng-content />
    </span>
  \`,
  host: { class: 'contents' },
})
export class TooltipTriggerComponent {
  private tooltip = inject(TooltipComponent, { optional: true });
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  onMouseEnter() {
    const delay = this.tooltip?.delayDuration() ?? 200;
    this.timeoutId = setTimeout(() => {
      this.tooltip?.show();
    }, delay);
  }

  onMouseLeave() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.tooltip?.hide();
  }

  onFocus() {
    this.tooltip?.show();
  }

  onBlur() {
    this.tooltip?.hide();
  }
}

@Component({
  selector: 'ui-tooltip-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    @if (tooltip?.open()) {
      <div [class]="classes()" [attr.data-slot]="'tooltip-content'">
        <ng-content />
      </div>
    }
  \`,
  host: { class: 'contents' },
})
export class TooltipContentComponent {
  tooltip = inject(TooltipComponent, { optional: true });
  class = input('');

  classes = computed(() => {
    const side = this.tooltip?.side() ?? 'top';
    const sideClasses = {
      top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
      bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
      left: 'right-full top-1/2 -translate-y-1/2 mr-2',
      right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    };
    return cn(
      'absolute z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground',
      sideClasses[side],
      this.class()
    );
  });
}

@Directive({
  selector: '[uiTooltip]',
  standalone: true,
  host: {
    '(mouseenter)': 'onMouseEnter()',
    '(mouseleave)': 'onMouseLeave()',
  },
})
export class TooltipDirective implements OnDestroy {
  uiTooltip = input.required<string>();
  tooltipSide = input<'top' | 'bottom' | 'left' | 'right'>('top');

  private el = inject(ElementRef);
  private renderer = inject(Renderer2);
  private tooltipElement: HTMLElement | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  onMouseEnter() {
    this.timeoutId = setTimeout(() => {
      this.showTooltip();
    }, 200);
  }

  onMouseLeave() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.hideTooltip();
  }

  private showTooltip() {
    if (this.tooltipElement) return;

    this.tooltipElement = this.renderer.createElement('div');
    const text = this.renderer.createText(this.uiTooltip());
    this.renderer.appendChild(this.tooltipElement, text);

    this.renderer.setAttribute(
      this.tooltipElement,
      'class',
      'fixed z-[9999] whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground pointer-events-none'
    );

    // Append first so we can measure it
    this.renderer.appendChild(document.body, this.tooltipElement);

    const hostEl = this.el.nativeElement as HTMLElement;
    let targetEl = hostEl;
    if (getComputedStyle(hostEl).display === 'contents') {
      targetEl = (hostEl.firstElementChild as HTMLElement) || hostEl;
    }

    const hostRect = targetEl.getBoundingClientRect();
    const tooltipRect = this.tooltipElement!.getBoundingClientRect();

    let side = this.tooltipSide();

    // Calculate initial position to check for overflow
    const calculatePosition = (currentSide: string) => {
      let t = 0;
      let l = 0;
      switch (currentSide) {
        case 'top':
          t = hostRect.top - tooltipRect.height - 8;
          l = hostRect.left + (hostRect.width - tooltipRect.width) / 2;
          break;
        case 'bottom':
          t = hostRect.bottom + 8;
          l = hostRect.left + (hostRect.width - tooltipRect.width) / 2;
          break;
        case 'left':
          t = hostRect.top + (hostRect.height - tooltipRect.height) / 2;
          l = hostRect.left - tooltipRect.width - 8;
          break;
        case 'right':
          t = hostRect.top + (hostRect.height - tooltipRect.height) / 2;
          l = hostRect.right + 8;
          break;
      }
      return { top: t, left: l };
    };

    let pos = calculatePosition(side);

    // Check for overflow and flip if needed
    const { innerWidth, innerHeight } = window;

    // Check vertical overflow
    if (side === 'top' && pos.top < 0) {
      side = 'bottom';
      pos = calculatePosition(side);
    } else if (side === 'bottom' && pos.top + tooltipRect.height > innerHeight) {
      side = 'top';
      pos = calculatePosition(side);
    }

    // Check horizontal overflow
    if (side === 'left' && pos.left < 0) {
      side = 'right';
      pos = calculatePosition(side);
    } else if (side === 'right' && pos.left + tooltipRect.width > innerWidth) {
      side = 'left';
      pos = calculatePosition(side);
    }

    // Clamp to viewport if still overflowing (e.g. mobile)
    pos.top = Math.max(8, Math.min(innerHeight - tooltipRect.height - 8, pos.top));
    pos.left = Math.max(8, Math.min(innerWidth - tooltipRect.width - 8, pos.left));

    this.renderer.setStyle(this.tooltipElement, 'top', \`\${pos.top}px\`);
    this.renderer.setStyle(this.tooltipElement, 'left', \`\${pos.left}px\`);
  }

  private hideTooltip() {
    if (this.tooltipElement) {
      this.renderer.removeChild(document.body, this.tooltipElement);
      this.tooltipElement = null;
    }
  }

  ngOnDestroy() {
    this.hideTooltip();
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }
}
`,
    },
    {
      name: 'tooltip/index.ts',
      content: `export * from './tooltip.component';
`,
    },
  ],
  dependencies: [],
};

// =============================================================================
// REGISTRY EXPORT
// =============================================================================

export const registry: Record<string, ComponentDefinition> = {
  button: buttonComponent,
  input: inputComponent,
  label: labelComponent,
  badge: badgeComponent,
  card: cardComponent,
  separator: separatorComponent,
  textarea: textareaComponent,
  skeleton: skeletonComponent,
  spinner: spinnerComponent,
  checkbox: checkboxComponent,
  switch: switchComponent,
  avatar: avatarComponent,
  alert: alertComponent,
  progress: progressComponent,
  'radio-group': radioGroupComponent,
  tabs: tabsComponent,
  accordion: accordionComponent,
  dialog: dialogComponent,
  'dropdown-menu': dropdownMenuComponent,
  tooltip: tooltipComponent,
};
