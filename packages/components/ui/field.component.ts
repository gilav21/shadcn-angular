import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../lib/utils';

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
})
export class FieldComponent {
    class = input('');
    orientation = input<'vertical' | 'horizontal'>('vertical');

    classes = computed(() => cn(
        'grid gap-2',
        this.orientation() === 'horizontal' && 'flex items-center gap-3',
        this.class()
    ));
}

/**
 * FieldGroup - Groups multiple fields together
 */
@Component({
    selector: 'ui-field-group',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'field-group'">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class FieldGroupComponent {
    class = input('');

    classes = computed(() => cn(
        'grid gap-4',
        this.class()
    ));
}

/**
 * FieldSet - Semantic fieldset for related fields
 */
@Component({
    selector: 'ui-field-set',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <fieldset [class]="classes()" [attr.data-slot]="'field-set'">
      <ng-content />
    </fieldset>
  `,
    host: { class: 'contents' },
})
export class FieldSetComponent {
    class = input('');

    classes = computed(() => cn(
        'grid gap-4 border-none p-0',
        this.class()
    ));
}

/**
 * FieldLabel - Label for a field
 */
@Component({
    selector: 'ui-field-label',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <label 
      [class]="classes()"
      [attr.data-slot]="'field-label'"
      [attr.for]="for()"
    >
      <ng-content />
    </label>
  `,
    host: { class: 'contents' },
})
export class FieldLabelComponent {
    class = input('');
    for = input('');

    classes = computed(() => cn(
        'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        this.class()
    ));
}

/**
 * FieldLegend - Legend for a fieldset
 */
@Component({
    selector: 'ui-field-legend',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <legend [class]="classes()" [attr.data-slot]="'field-legend'">
      <ng-content />
    </legend>
  `,
    host: { class: 'contents' },
})
export class FieldLegendComponent {
    class = input('');

    classes = computed(() => cn(
        'text-sm font-medium leading-none',
        this.class()
    ));
}

/**
 * FieldDescription - Helper text for a field
 */
@Component({
    selector: 'ui-field-description',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <p [class]="classes()" [attr.data-slot]="'field-description'">
      <ng-content />
    </p>
  `,
    host: { class: 'contents' },
})
export class FieldDescriptionComponent {
    class = input('');

    classes = computed(() => cn(
        'text-sm text-muted-foreground',
        this.class()
    ));
}

/**
 * FieldError - Error message for a field
 */
@Component({
    selector: 'ui-field-error',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <p [class]="classes()" [attr.data-slot]="'field-error'" role="alert">
      <ng-content />
    </p>
  `,
    host: { class: 'contents' },
})
export class FieldErrorComponent {
    class = input('');

    classes = computed(() => cn(
        'text-sm text-destructive',
        this.class()
    ));
}

/**
 * FieldSeparator - Visual separator between fields
 */
@Component({
    selector: 'ui-field-separator',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <hr [class]="classes()" [attr.data-slot]="'field-separator'" />
  `,
    host: { class: 'contents' },
})
export class FieldSeparatorComponent {
    class = input('');

    classes = computed(() => cn(
        'my-4 border-t border-border',
        this.class()
    ));
}
