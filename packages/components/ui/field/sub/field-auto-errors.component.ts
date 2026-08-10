import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
  inject,
  effect,
} from '@angular/core';
import type { AbstractControl } from '@angular/forms';
import { FIELD_CONTEXT } from '../field.component';
import { FIELD_ERROR_LOCALES, type FieldErrorsLocale } from '../field.locales';
import { createLocaleSelector, interpolate } from '../../../lib/i18n/i18n.utils';
import type { LocaleInput } from '../../../lib/i18n/i18n.types';
import { FieldErrorComponent } from './field-error.component';

/**
 * FieldAutoErrors - Automatically renders the first active validation error
 * of the field's form control, localized via the field error locales.
 *
 * Implicit mode (zero wiring) — picks up the control projected into the
 * surrounding `ui-field`:
 * ```html
 * <ui-field>
 *   <ui-field-label>Email</ui-field-label>
 *   <ui-input [formControl]="email" />
 *   <ui-field-auto-errors />
 * </ui-field>
 * ```
 *
 * Explicit mode — pass the control directly:
 * ```html
 * <ui-field-auto-errors [control]="form.controls.email" />
 * ```
 *
 * Message lookup precedence per error key:
 * 1. the `messages` input (per-instance overrides, e.g. custom validators)
 * 2. the resolved locale dictionary (`field.locales.ts` — edit it freely)
 * 3. the raw error key itself
 *
 * Templates are interpolated against Angular's validation error object, so
 * `{requiredLength}`, `{min}`, `{max}` etc. resolve automatically.
 */
@Component({
  selector: 'ui-field-auto-errors',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldErrorComponent],
  template: `
    @if (message(); as msg) {
      <ui-field-error [class]="class()">{{ msg }}</ui-field-error>
    }
  `,
  host: { class: 'contents' },
})
export class FieldAutoErrorsComponent {
  /**
   * Locale dictionary or registry key used to turn Angular validation error keys
   * into messages. Falls back to `UI_LOCALE_ID`. Per-instance {@link messages}
   * entries win over it.
   */
  readonly locale = input<LocaleInput<FieldErrorsLocale>>();
  /** Extra classes forwarded to the `ui-field-error` this renders — nothing is rendered at all while the control has no active error. */
  readonly class = input('');
  /** Explicit control — overrides the one detected from the surrounding ui-field. */
  readonly control = input<AbstractControl | null>(null);
  /** Per-instance message overrides keyed by error name (e.g. custom validators). */
  readonly messages = input<Record<string, string>>({});

  private readonly context = inject(FIELD_CONTEXT, { optional: true });
  private readonly t = createLocaleSelector(this.locale, FIELD_ERROR_LOCALES);
  private readonly tick = signal(0);

  private readonly resolvedControl = computed(
    () => this.control() ?? this.context?.control?.()?.control ?? null,
  );

  constructor() {
    effect(onCleanup => {
      const ctrl = this.resolvedControl();
      if (!ctrl) return;
      const subscription = ctrl.events.subscribe(() => this.tick.update(n => n + 1));
      onCleanup(() => subscription.unsubscribe());
    });
  }

  readonly message = computed(() => {
    this.tick();
    const ctrl = this.resolvedControl();
    if (!ctrl?.errors || !(ctrl.touched || ctrl.dirty)) return null;
    const [key, errorValue] = Object.entries(ctrl.errors)[0];
    const template = this.messages()[key] ?? this.localeTemplate(key) ?? key;
    if (errorValue && typeof errorValue === 'object') {
      return interpolate(template, errorValue as Record<string, string | number>);
    }
    return template;
  });

  private localeTemplate(key: string): string | undefined {
    const dict = this.t() as unknown as Record<string, string | undefined>;
    return dict[key];
  }
}
