# Using these components with Angular Signal Forms

Angular 21 ships **Signal Forms** (`@angular/forms/signals`): a signal-native
forms system where a `FieldTree` is bound to a control through the `FormField`
directive instead of a `FormControl` and a `ControlValueAccessor`.

Every form control in this library is usable inside a signal form. Nothing was
removed to get there — `[(value)]`, `ngModel` and `formControlName` all behave
exactly as before.

## The short version

```ts
import { Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { InputComponent, SelectComponent } from './components/ui';

@Component({
  selector: 'app-profile',
  imports: [InputComponent, SelectComponent, FormField],
  template: `
    <ui-input [formField]="profile.name" />
    <ui-select [formField]="profile.role" [options]="roles" />
  `,
})
export class ProfileComponent {
  readonly roles = ['admin', 'editor', 'viewer'];
  readonly model = signal({ name: '', role: 'viewer' });
  readonly profile = form(this.model);
}
```

The directive's selector is `[formField]`. (Some early write-ups of Signal
Forms show `[field]` and `[formRoot]`; those are not in the released API as of
`@angular/forms@21.2.17`.)

`form()` also accepts a signal of a primitive, which is handy for a single
control:

```ts
readonly colour = signal('#3b82f6');
readonly colourField = form(this.colour);
// <ui-color-picker [formField]="colourField" />
```

## What makes a component work with `[formField]`

`FormValueControl<T>` — the contract a control satisfies — has exactly one
required member:

> The value is the only required property in this contract. A component that
> wants to integrate with the `Field` directive via this contract **must**
> provide a `model()` that will be kept in sync with the value of the bound
> `FieldTree`.

Checkbox-like controls implement `FormCheckboxControl` instead, whose one
required member is `checked`. Everything else — `disabled`, `required`,
`min`, `max`, `maxLength`, `errors`, `name`, `focus()` — is optional and is
synced automatically when present.

That is a *structural* contract: no import from `@angular/forms/signals` is
needed to satisfy it, which is why none of these components import it.

## Controls you can bind

| Control | Contract | Value type |
|---|---|---|
| `ui-input` | `FormValueControl` | `string` |
| `ui-textarea` | `FormValueControl` | `string` |
| `ui-input-otp` | `FormValueControl` | `string` |
| `ui-input-group-input` | `FormValueControl` | `string` |
| `ui-select` | `FormValueControl` | `T \| undefined` |
| `ui-autocomplete` | `FormValueControl` | `T \| T[] \| null \| undefined` |
| `ui-number-input` | `FormValueControl` | `number \| null` |
| `ui-phone-input` | `FormValueControl` | `string \| null` (E.164) |
| `ui-radio-group` | `FormValueControl` | `string \| undefined` |
| `ui-slider` | `FormValueControl` | `number` |
| `ui-toggle-group` | `FormValueControl` | `string \| string[] \| undefined` |
| `ui-rating` | `FormValueControl` | `number` |
| `ui-color-picker` | `FormValueControl` | `string` (hex) |
| `ui-checkbox` | `FormCheckboxControl` | `boolean` |
| `ui-switch` | `FormCheckboxControl` | `boolean` |

## Disabling from the schema

`disabled()` in a schema disables the control, because each of these exposes a
`disabled` input in the shape the contract expects:

```ts
readonly field = form(this.model, path => {
  disabled(path, 'Read-only while the account is locked');
});
```

## Two behaviours worth knowing

**A `ControlValueAccessor` wins over the model.** When a control provides
`NG_VALUE_ACCESSOR` — which all of these except `ui-input-otp`, `ui-slider` and
`ui-toggle-group` do — `FormField` binds through the CVA and registers its
`onChange` into the field state. The value model still matters (it is what
makes the component conform, and it carries the non-CVA controls), but the
value traffic for those controls flows through `writeValue`/`onChange`.

**`valueChange` on a converted control emits `T | undefined`.** A control whose
value can be empty is a `model<T | undefined>(undefined)`, and Angular derives
the output type from the model. If you assign the event straight into a
non-optional target, narrow it:

```html
<!-- was fine before, now errors under strictTemplates -->
<ui-select [value]="align()" (valueChange)="align.set($event)" />

<!-- narrow at the call site -->
<ui-select [value]="align()" (valueChange)="align.set($event ?? 'center')" />
```

Component code that subscribed to the output through the class member also
moves from `component.valueChange.subscribe(…)` to `component.value.subscribe(…)`
— a `ModelSignal` *is* the output. Template bindings are unaffected.

## Angular 20

All of this is free on Angular 20. `model()` has existed since 17.2, and
satisfying the contract needs no import from `@angular/forms/signals`, so every
converted component compiles unchanged there. Only the *tests* that build a
`form()` are Angular 21-only, and they live outside `packages/components/ui/`
so they are never installed into your project.
