import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  InjectionToken,
  inject,
  signal,
  ContentChild,
  AfterContentInit,
  type WritableSignal,
} from '@angular/core';
import { NgControl } from '@angular/forms';
import { cn } from '../../lib/utils';

let fieldIdCounter = 0;

/**
 * Context for field components to communicate ARIA relationships
 */
export interface FieldContext {
  fieldId: string;
  registerDescribedBy: (id: string) => void;
  unregisterDescribedBy: (id: string) => void;
  getDescribedByIds: () => string[];
  /** The form control directive projected into the field, if any. */
  control?: WritableSignal<NgControl | null>;
}

export const FIELD_CONTEXT = new InjectionToken<FieldContext>('FIELD_CONTEXT');

/**
 * Field - Form field wrapper with label, description, and error support
 *
 * Usage:
 * <ui-field>
 *   <ui-field-label for="email">Email</ui-field-label>
 *   <ui-input id="email" />
 *   <ui-field-description>We'll never share your email.</ui-field-description>
 * </ui-field>
 */
@Component({
  selector: 'ui-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      [class]="classes()"
      [attr.data-slot]="'field'"
      [attr.data-orientation]="orientation()"
    >
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
  providers: [
    {
      provide: FIELD_CONTEXT,
      useFactory: () => {
        const fieldId = `field-${++fieldIdCounter}`;
        const describedByIds = signal<string[]>([]);

        return {
          fieldId,
          registerDescribedBy: (id: string) => {
            describedByIds.update(ids => [...ids, id]);
          },
          unregisterDescribedBy: (id: string) => {
            describedByIds.update(ids => ids.filter(i => i !== id));
          },
          getDescribedByIds: () => describedByIds(),
          control: signal<NgControl | null>(null),
        } as FieldContext;
      },
    },
  ],
  exportAs: 'uiField',
})
export class FieldComponent implements AfterContentInit {
  class = input('');
  orientation = input<'vertical' | 'horizontal'>('vertical');

  /** The projected form control directive (formControl / formControlName / ngModel). */
  @ContentChild(NgControl) ngControl?: NgControl;

  private readonly context = inject(FIELD_CONTEXT);

  ngAfterContentInit() {
    this.context.control?.set(this.ngControl ?? null);
  }

  /**
   * Get the combined aria-describedby value for this field's input.
   * Use this on your input: [attr.aria-describedby]="field.describedBy()"
   */
  describedBy = computed(() => {
    const ids = this.context.getDescribedByIds();
    return ids.length > 0 ? ids.join(' ') : null;
  });

  classes = computed(() => cn(
    'grid gap-2',
    this.orientation() === 'horizontal' && 'flex items-center gap-3',
    this.class()
  ));
}
