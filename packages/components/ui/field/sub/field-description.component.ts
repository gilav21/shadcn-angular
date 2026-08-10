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
 * FieldDescription - Helper text for a field
 */
@Component({
  selector: 'ui-field-description',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p [id]="id()" [class]="classes()" [attr.data-slot]="'field-description'">
      <ng-content />
    </p>
  `,
  host: { class: 'contents' },
})
export class FieldDescriptionComponent implements OnInit, OnDestroy {
  /** Extra classes merged onto the helper `<p>`. */
  class = input('');
  /**
   * Explicit element id. Leave it empty and one is generated: either way the id
   * is registered with the surrounding `ui-field` and shows up in its
   * `describedBy`, which you bind to the control's `aria-describedby`.
   */
  id = input<string>('');

  private readonly context = inject(FIELD_CONTEXT, { optional: true });
  private generatedId = '';

  readonly resolvedId = computed(() => this.id() || this.generatedId);

  ngOnInit(): void {
    this.generatedId = registerFieldDescribedBy(this.context, this.id(), 'description');
  }

  ngOnDestroy(): void {
    unregisterFieldDescribedBy(this.context, this.generatedId);
  }

  classes = computed(() => cn(
    'text-sm text-muted-foreground',
    this.class()
  ));
}
