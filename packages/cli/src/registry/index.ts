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
      [class]="indicatorClasses()"
      [style.transform]="'translateX(-' + (100 - (value() ?? 0)) + '%)'"
    ></div>
  \`,
  host: {
    '[class]': 'classes()',
    '[attr.role]': '"progressbar"',
    '[attr.aria-valuemin]': '0',
    '[attr.aria-valuemax]': '100',
    '[attr.aria-valuenow]': 'value()',
    '[attr.data-slot]': '"progress"',
  },
})
export class ProgressComponent {
  value = input<number>(0);
  class = input('');

  classes = computed(() =>
    cn(
      'relative h-2 w-full overflow-hidden rounded-full bg-primary/20',
      this.class()
    )
  );

  indicatorClasses = computed(() =>
    cn('h-full w-full flex-1 bg-primary transition-all')
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
};
