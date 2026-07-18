import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  StepperComponent,
  StepperItemComponent,
  StepperTriggerComponent,
  StepperTitleComponent,
  StepperContentComponent,
  StepperSeparatorComponent,
} from './index';

/**
 * Simple-mode host with fully configurable orientation / linear / activeStep so
 * the data-driven template paths (stepItemClasses, stepTriggerClasses,
 * getStepStatusByIndex, canNavigateToIndex) are all exercised, and the public
 * StepperComponent instance can be driven directly (next/prev/goto/getStepIndex).
 */
@Component({
  template: `
    <ui-stepper
      [steps]="steps()"
      [(activeStep)]="activeStep"
      [orientation]="orientation()"
      [linear]="linear()"
      (stepChange)="last.set($event)"
    />
  `,
  imports: [StepperComponent],
})
class SimpleHost {
  readonly steps = signal([
    { value: 'a', title: 'A', description: 'first' },
    { value: 'b', title: 'B' },
    { value: 'c', title: 'C' },
  ]);
  readonly activeStep = signal(0);
  readonly orientation = signal<'horizontal' | 'vertical'>('horizontal');
  readonly linear = signal(false);
  readonly last = signal(-1);
}

/** Template/projection host (steps() empty) so nextStep uses items().length. */
@Component({
  template: `
    <ui-stepper [(activeStep)]="activeStep">
      <ui-stepper-item value="s1"><ui-stepper-trigger>1</ui-stepper-trigger></ui-stepper-item>
      <ui-stepper-item value="s2"><ui-stepper-trigger>2</ui-stepper-trigger></ui-stepper-item>
    </ui-stepper>
  `,
  imports: [StepperComponent, StepperItemComponent, StepperTriggerComponent],
})
class TemplateHost {
  readonly activeStep = signal(0);
}

function getStepper(fixture: ComponentFixture<unknown>): StepperComponent {
  return fixture.debugElement.query(By.directive(StepperComponent)).componentInstance;
}

describe('StepperComponent — data-driven public API', () => {
  let fixture: ComponentFixture<SimpleHost>;
  let host: SimpleHost;
  let stepper: StepperComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SimpleHost] }).compileComponents();
    fixture = TestBed.createComponent(SimpleHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    stepper = getStepper(fixture);
  });

  it('getStepIndex resolves against the steps array (simple mode)', () => {
    expect(stepper.getStepIndex('b')).toBe(1);
    expect(stepper.getStepIndex('missing')).toBe(-1);
  });

  it('nextStep advances and clamps to the last step, using steps().length', () => {
    stepper.nextStep();
    expect(host.activeStep()).toBe(1);
    stepper.nextStep();
    expect(host.activeStep()).toBe(2);
    stepper.nextStep();
    expect(host.activeStep()).toBe(2);
    expect(host.last()).toBe(2);
  });

  it('prevStep decrements and clamps to zero', () => {
    host.activeStep.set(2);
    fixture.detectChanges();
    stepper.prevStep();
    expect(host.activeStep()).toBe(1);
    stepper.prevStep();
    stepper.prevStep();
    expect(host.activeStep()).toBe(0);
  });

  it('renders vertical layout (stepItemClasses vertical branch)', () => {
    host.orientation.set('vertical');
    fixture.detectChanges();
    const item = fixture.debugElement.query(By.css('[data-slot="stepper-item"]'));
    expect(item.nativeElement.className).toContain('flex-row');
    expect(item.nativeElement.dataset.orientation).toBe('vertical');
  });

  it('linear mode disables and dims unreachable triggers (stepTriggerClasses/canNavigateToIndex)', () => {
    host.linear.set(true);
    fixture.detectChanges();
    const triggers = fixture.debugElement.queryAll(By.css('[data-slot="stepper-trigger"]'));
    expect(triggers[2].nativeElement.disabled).toBe(true);
    expect(triggers[2].nativeElement.className).toContain('opacity-50');
  });

  it('goToStep is a no-op when navigation is blocked in linear mode', () => {
    host.linear.set(true);
    fixture.detectChanges();
    host.last.set(-1);
    stepper.goToStep(2);
    expect(host.activeStep()).toBe(0);
    expect(host.last()).toBe(-1);
  });

  it('exposes step count via the internal computed', () => {
    const count = (stepper as unknown as { simpleStepCount: () => number }).simpleStepCount();
    expect(count).toBe(3);
  });
});

describe('StepperComponent — projected items nextStep', () => {
  it('nextStep clamps using items().length when steps() is empty', async () => {
    await TestBed.configureTestingModule({ imports: [TemplateHost] }).compileComponents();
    const fixture = TestBed.createComponent(TemplateHost);
    fixture.detectChanges();
    const stepper = getStepper(fixture);
    expect(stepper.getStepIndex('s2')).toBe(1);
    stepper.nextStep();
    expect(fixture.componentInstance.activeStep()).toBe(1);
    stepper.nextStep();
    expect(fixture.componentInstance.activeStep()).toBe(1);
  });
});

/** Sub-components rendered without a parent stepper → optional-injection fallbacks. */
@Component({
  template: `
    <ui-stepper-item value="orphan">
      <ui-stepper-trigger>content</ui-stepper-trigger>
    </ui-stepper-item>
  `,
  imports: [StepperItemComponent, StepperTriggerComponent],
})
class OrphanHost {}

describe('Stepper sub-components without a parent stepper', () => {
  let fixture: ComponentFixture<OrphanHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [OrphanHost] }).compileComponents();
    fixture = TestBed.createComponent(OrphanHost);
    fixture.detectChanges();
  });

  it('item falls back to index 0 / pending status / isLast=true', () => {
    const item: StepperItemComponent = fixture.debugElement.query(
      By.directive(StepperItemComponent)
    ).componentInstance;
    expect(item.index()).toBe(0);
    expect(item.status()).toBe('pending');
    expect(item.isLast()).toBe(true);
  });

  it('trigger falls back to step number 1 / clickable / no-op onClick', () => {
    const trigger: StepperTriggerComponent = fixture.debugElement.query(
      By.directive(StepperTriggerComponent)
    ).componentInstance;
    expect(trigger.stepNumber()).toBe(1);
    expect(trigger.canClick()).toBe(true);
    expect(() => trigger.onClick()).not.toThrow();
  });
});

/** Separator inside a stepper: complete vs pending, horizontal vs vertical. */
@Component({
  template: `
    <ui-stepper [(activeStep)]="activeStep" [orientation]="orientation()">
      <ui-stepper-item value="one">
        <ui-stepper-trigger><ui-stepper-title>One</ui-stepper-title></ui-stepper-trigger>
        <ui-stepper-separator />
        <ui-stepper-content>c1</ui-stepper-content>
      </ui-stepper-item>
      <ui-stepper-item value="two">
        <ui-stepper-trigger><ui-stepper-title>Two</ui-stepper-title></ui-stepper-trigger>
        <ui-stepper-separator />
        <ui-stepper-content>c2</ui-stepper-content>
      </ui-stepper-item>
    </ui-stepper>
  `,
  imports: [
    StepperComponent,
    StepperItemComponent,
    StepperTriggerComponent,
    StepperTitleComponent,
    StepperContentComponent,
    StepperSeparatorComponent,
  ],
})
class SeparatorHost {
  readonly activeStep = signal(1);
  readonly orientation = signal<'horizontal' | 'vertical'>('horizontal');
}

describe('StepperSeparatorComponent', () => {
  let fixture: ComponentFixture<SeparatorHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SeparatorHost] }).compileComponents();
    fixture = TestBed.createComponent(SeparatorHost);
    fixture.detectChanges();
  });

  it('reflects complete / incomplete state and horizontal sizing', () => {
    const seps = fixture.debugElement.queryAll(By.css('[data-slot="stepper-separator"]'));
    expect(seps).toHaveLength(2);
    // activeStep=1 → item "one" (index 0) complete, item "two" (index 1) current.
    expect(seps[0].nativeElement.dataset.complete).toBe('true');
    expect(seps[0].nativeElement.className).toContain('bg-primary');
    expect(seps[0].nativeElement.className).toContain('w-full');
    expect(seps[1].nativeElement.dataset.complete).toBeUndefined();
    expect(seps[1].nativeElement.className).toContain('bg-border');
  });

  it('applies vertical sizing classes', () => {
    fixture.componentInstance.orientation.set('vertical');
    fixture.detectChanges();
    const sep = fixture.debugElement.query(By.css('[data-slot="stepper-separator"]'));
    expect(sep.nativeElement.className).toContain('w-0.5');
    expect(sep.nativeElement.className).toContain('h-8');
  });
});
