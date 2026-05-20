import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { FIELD_CONTEXT } from '../field.component';
import { registerFieldDescribedBy, unregisterFieldDescribedBy } from '../field.utils';

/**
 * FieldError - Error message for a field
 */
@Component({
  selector: 'ui-field-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p [id]="id()" [class]="classes()" [attr.data-slot]="'field-error'" role="alert" aria-live="polite">
      <ng-content />
    </p>
  `,
  host: { class: 'contents' },
})
export class FieldErrorComponent implements OnInit, OnDestroy {
  class = input('');
  id = input<string>('');

  private readonly context = inject(FIELD_CONTEXT, { optional: true });
  private generatedId = '';

  readonly resolvedId = computed(() => this.id() || this.generatedId);

  ngOnInit() {
    this.generatedId = registerFieldDescribedBy(this.context, this.id(), 'error');
  }

  ngOnDestroy() {
    unregisterFieldDescribedBy(this.context, this.generatedId);
  }

  classes = computed(() => cn(
    'text-sm text-destructive',
    this.class()
  ));
}
