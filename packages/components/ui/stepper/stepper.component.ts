import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  InjectionToken,
  forwardRef,
  contentChildren,
  model,
  output,
  signal,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { StepperItemComponent } from './sub/stepper-item.component';

export type StepStatus = 'pending' | 'current' | 'complete' | 'error';

export interface StepConfig {
  value: string;
  title: string;
  description?: string;
}

/**
 * Gate consulted before the stepper leaves the current step.
 *
 * Return `true` to allow the move and `false` to block it. Returning a promise
 * puts the stepper in {@link StepperComponent.guardPending} until it settles;
 * a promise that resolves `false`, rejects, or a guard that throws all block
 * the transition. Both indices are supplied so a guard can allow backwards
 * navigation while validating forwards (`(from, to) => to < from || isValid()`).
 */
export type StepGuard = (from: number, to: number) => boolean | Promise<boolean>;

/** Payload of `(stepBlocked)` — the move a {@link StepGuard} refused. */
export interface StepBlockedEvent {
  readonly from: number;
  readonly to: number;
}

export const STEPPER = new InjectionToken<StepperComponent>('STEPPER');

@Component({
  selector: 'ui-stepper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STEPPER, useExisting: forwardRef(() => StepperComponent) }],
  templateUrl: './stepper.component.html',
  host: { class: 'block' },
})
export class StepperComponent {
  /** Extra classes merged onto the root `<ol>` (via `cn()`, so utilities here win over the built-in flex/orientation ones). */
  class = input('');
  /**
   * Lays the steps out in a row (`horizontal`, the default) or a column (`vertical`).
   * Horizontal additionally renders a connector bar after every step but the last —
   * both here and in {@link StepperItemComponent} — and lets the row scroll on overflow;
   * vertical renders none and switches each item to an icon-beside-text row.
   */
  orientation = input<'horizontal' | 'vertical'>('horizontal');
  /**
   * Zero-based index of the current step. It is a two-way `model`, so the stepper
   * owns it by default but a consumer can bind `[(activeStep)]` to drive it; every
   * internal move goes through {@link goToStep}, which writes it and emits
   * {@link stepChange}.
   */
  activeStep = model(0);
  /** When true, {@link canNavigateTo} rejects any index past {@link activeStep}, so future steps render disabled/dimmed and can only be reached by {@link nextStep}. */
  linear = input(false);

  /**
   * Optional validation gate run before every move that actually changes
   * {@link activeStep} — the "validate this step before advancing" hook.
   * `null` (the default) leaves navigation exactly as it was.
   *
   * A guard returning a plain boolean keeps the whole transition synchronous:
   * the step changes (or does not) in the same tick as the click. Returning a
   * promise flips {@link guardPending} on until it settles, and the stepper
   * ignores the result if the user started another move in the meantime.
   *
   * A refusal — `false`, a promise resolving `false`, a rejection, or a throw —
   * blocks the move, leaves {@link activeStep} alone, emits {@link stepBlocked}
   * and emits no {@link stepChange}.
   *
   * It runs *after* the {@link linear} gate, so a guard is never asked about a
   * move linear mode already rejected.
   */
  canLeave = input<StepGuard | null>(null);

  /**
   * Simple mode: pass a step list and the stepper renders the whole row itself
   * (indicator, title, description, connectors). A non-empty array replaces the
   * projected content entirely — the `<ng-content />` template mode is only used
   * when this is empty.
   */
  steps = input<StepConfig[]>([]);

  /** Emits the newly-selected index whenever {@link goToStep} actually moves — not on a rejected (non-linear-allowed) click, and not when {@link activeStep} is set from outside. */
  stepChange = output<number>();

  /** Emits the attempted move whenever a {@link canLeave} guard refuses it. Never fires when no guard is set. */
  readonly stepBlocked = output<StepBlockedEvent>();

  items = contentChildren(StepperItemComponent);

  private readonly _guardPending = signal(false);
  /** `true` while an async {@link canLeave} guard is still deciding — bind it to a spinner or to disable the Next button. */
  readonly guardPending = this._guardPending.asReadonly();
  private guardToken = 0;

  // For simple mode, use steps array length
  private readonly simpleStepCount = computed(() => this.steps().length);

  classes = computed(() =>
    cn(
      'flex',
      this.orientation() === 'horizontal' ? 'flex-row items-start overflow-x-auto' : 'flex-col',
      this.class()
    )
  );

  stepItemClasses = computed(() =>
    cn(
      'flex shrink-0',
      this.orientation() === 'vertical' ? 'flex-row gap-4' : 'flex-col items-center gap-2'
    )
  );

  stepTriggerClasses = (canClick: boolean): string =>
    cn(
      'group flex items-center gap-3 text-start',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md',
      !canClick && 'cursor-not-allowed opacity-50'
    );

  indicatorClasses = (status: StepStatus): string =>
    cn(
      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
      {
        'border-muted bg-muted text-muted-foreground': status === 'pending',
        'border-primary bg-primary text-primary-foreground': status === 'current' || status === 'complete',
        'border-destructive bg-destructive text-destructive-foreground': status === 'error',
      }
    );

  /** Resolves a step's `value` to its zero-based position, looking in {@link steps} in simple mode and in the projected {@link StepperItemComponent} children otherwise. Returns `-1` if no step carries that value. */
  getStepIndex(value: string): number {
    if (this.steps().length > 0) {
      return this.steps().findIndex((s) => s.value === value);
    }
    return this.items().findIndex((item) => item.value() === value);
  }

  /**
   * Status of the step at `index`, derived purely from {@link activeStep}: before it
   * `'complete'` (check icon, filled indicator, primary-coloured connector), on it
   * `'current'` (filled indicator, number), after it `'pending'` (muted). `'error'`
   * is part of {@link StepStatus} and styled by the trigger, but is never returned
   * here — set it by overriding the item's status yourself.
   */
  getStepStatus(index: number): StepStatus {
    const active = this.activeStep();
    if (index < active) return 'complete';
    if (index === active) return 'current';
    return 'pending';
  }

  /** Template-facing alias of {@link getStepStatus}, used by the simple-mode markup where only the loop index is available. */
  getStepStatusByIndex(index: number): StepStatus {
    return this.getStepStatus(index);
  }

  /** Whether a click may jump to `index`: always true unless {@link linear} is set, in which case only the current step and the ones already completed are reachable. Gates both the trigger's `disabled` state and {@link goToStep}. */
  canNavigateTo(index: number): boolean {
    if (!this.linear()) return true;
    return index <= this.activeStep();
  }

  /** Template-facing alias of {@link canNavigateTo}, used by the simple-mode markup where only the loop index is available. */
  canNavigateToIndex(index: number): boolean {
    return this.canNavigateTo(index);
  }

  /** Moves to `index`, updating {@link activeStep} and emitting {@link stepChange}. A no-op — silently, with no emission — when {@link canNavigateTo} rejects the index. Does not clamp, so callers must pass an in-range index. */
  goToStep(index: number): void {
    if (!this.canNavigateTo(index)) return;

    const from = this.activeStep();
    const guard = this.canLeave();
    if (!guard || index === from) {
      this.commitStep(index);
      return;
    }

    let outcome: boolean | Promise<boolean>;
    try {
      outcome = guard(from, index);
    } catch {
      outcome = false;
    }

    if (typeof outcome === 'boolean') {
      this.settleGuard(outcome, from, index);
      return;
    }

    const token = ++this.guardToken;
    this._guardPending.set(true);
    outcome.then(
      allowed => this.settleAsyncGuard(token, allowed, from, index),
      () => this.settleAsyncGuard(token, false, from, index)
    );
  }

  private settleAsyncGuard(token: number, allowed: boolean, from: number, to: number): void {
    if (token !== this.guardToken) return;
    this._guardPending.set(false);
    this.settleGuard(allowed, from, to);
  }

  private settleGuard(allowed: boolean, from: number, to: number): void {
    if (allowed) {
      this.commitStep(to);
      return;
    }
    this.stepBlocked.emit({ from, to });
  }

  private commitStep(index: number): void {
    this.activeStep.set(index);
    this.stepChange.emit(index);
  }

  /** Advances one step through {@link goToStep}, clamped at the last step (counted from {@link steps} in simple mode, from the projected items otherwise). This is the only way forward when {@link linear} is set. */
  nextStep(): void {
    const count = this.steps().length > 0 ? this.steps().length : this.items().length;
    const next = Math.min(this.activeStep() + 1, count - 1);
    this.goToStep(next);
  }

  /** Goes back one step through {@link goToStep}, clamped at `0`. Always permitted, since earlier steps stay reachable even under {@link linear}. */
  prevStep(): void {
    const prev = Math.max(this.activeStep() - 1, 0);
    this.goToStep(prev);
  }
}
