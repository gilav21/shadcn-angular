import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { StepperComponent, type StepConfig, type StepGuard } from './stepper.component';

const STEPS: StepConfig[] = [
    { value: 'one', title: 'One' },
    { value: 'two', title: 'Two' },
    { value: 'three', title: 'Three' },
];

@Component({
    imports: [StepperComponent],
    template: `<ui-stepper [steps]="steps" [canLeave]="guard()" />`,
})
class GuardHostComponent {
    readonly steps = STEPS;
    readonly guard = signal<StepGuard | null>(null);
}

@Component({
    imports: [StepperComponent],
    template: `<ui-stepper [steps]="steps" [linear]="true" [canLeave]="guard" />`,
})
class LinearGuardHostComponent {
    readonly steps = STEPS;
    calls = 0;
    readonly guard: StepGuard = () => { this.calls++; return true; };
}

describe('StepperComponent — canLeave guard', () => {
    let fixture: ComponentFixture<GuardHostComponent>;
    let host: GuardHostComponent;
    let stepper: StepperComponent;

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [GuardHostComponent] });
        fixture = TestBed.createComponent(GuardHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
        stepper = fixture.debugElement.children[0].componentInstance as StepperComponent;
    });

    it('advances normally when no guard is supplied', () => {
        stepper.nextStep();
        expect(stepper.activeStep()).toBe(1);
        expect(stepper.guardPending()).toBe(false);
    });

    it('blocks the transition when a sync guard returns false', () => {
        const seen: { from: number; to: number }[] = [];
        host.guard.set((from, to) => { seen.push({ from, to }); return false; });
        fixture.detectChanges();

        stepper.nextStep();

        expect(stepper.activeStep()).toBe(0);
        expect(seen).toEqual([{ from: 0, to: 1 }]);
    });

    it('allows the transition when a sync guard returns true — synchronously', () => {
        host.guard.set(() => true);
        fixture.detectChanges();

        stepper.nextStep();

        expect(stepper.activeStep()).toBe(1);
        expect(stepper.guardPending()).toBe(false);
    });

    it('emits stepBlocked when a guard refuses', () => {
        const blocked: { from: number; to: number }[] = [];
        stepper.stepBlocked.subscribe(e => blocked.push(e));
        host.guard.set(() => false);
        fixture.detectChanges();

        stepper.nextStep();

        expect(blocked).toEqual([{ from: 0, to: 1 }]);
    });

    it('treats a guard that throws as a refusal', () => {
        host.guard.set(() => { throw new Error('validation exploded'); });
        fixture.detectChanges();

        expect(() => stepper.nextStep()).not.toThrow();
        expect(stepper.activeStep()).toBe(0);
    });

    it('does not run the guard for a no-op move to the current step', () => {
        let calls = 0;
        host.guard.set(() => { calls++; return true; });
        fixture.detectChanges();

        stepper.goToStep(0);

        expect(calls).toBe(0);
        expect(stepper.activeStep()).toBe(0);
    });

    it('shows pending state then allows an async guard', async () => {
        let release!: (ok: boolean) => void;
        host.guard.set(() => new Promise<boolean>(resolve => { release = resolve; }));
        fixture.detectChanges();

        stepper.nextStep();
        expect(stepper.guardPending()).toBe(true);
        expect(stepper.activeStep()).toBe(0);

        release(true);
        await fixture.whenStable();

        expect(stepper.guardPending()).toBe(false);
        expect(stepper.activeStep()).toBe(1);
    });

    it('shows pending state then blocks an async guard that resolves false', async () => {
        host.guard.set(() => Promise.resolve(false));
        fixture.detectChanges();

        stepper.nextStep();
        expect(stepper.guardPending()).toBe(true);

        await fixture.whenStable();

        expect(stepper.guardPending()).toBe(false);
        expect(stepper.activeStep()).toBe(0);
    });

    it('blocks when an async guard rejects', async () => {
        host.guard.set(() => Promise.reject(new Error('server said no')));
        fixture.detectChanges();

        stepper.nextStep();
        await fixture.whenStable();

        expect(stepper.guardPending()).toBe(false);
        expect(stepper.activeStep()).toBe(0);
    });

    it('ignores a stale async guard result once a newer move started', async () => {
        const resolvers: ((ok: boolean) => void)[] = [];
        host.guard.set(() => new Promise<boolean>(resolve => { resolvers.push(resolve); }));
        fixture.detectChanges();

        stepper.goToStep(1);
        stepper.goToStep(2);

        resolvers[0](true);
        resolvers[1](true);
        await fixture.whenStable();

        expect(stepper.activeStep()).toBe(2);
    });

    it('lets a later SYNCHRONOUS move invalidate a guard still in flight', async () => {
        // Regression: the sync branch used not to bump the staleness token, so a
        // sync move landed, then the older promise resolved and snapped the
        // stepper back — emitting stepChange twice, as [2, 1].
        const changes: number[] = [];
        stepper.stepChange.subscribe(i => changes.push(i));

        let releaseFirst!: (ok: boolean) => void;
        let asyncCalls = 0;
        host.guard.set((): boolean | Promise<boolean> => {
            asyncCalls++;
            return asyncCalls === 1
                ? new Promise<boolean>(resolve => { releaseFirst = resolve; })
                : true;
        });
        fixture.detectChanges();

        stepper.goToStep(1);
        expect(stepper.guardPending()).toBe(true);

        stepper.goToStep(2);
        expect(stepper.activeStep()).toBe(2);
        expect(stepper.guardPending()).toBe(false);

        releaseFirst(true);
        await fixture.whenStable();

        expect(stepper.activeStep()).toBe(2);
        expect(stepper.guardPending()).toBe(false);
        expect(changes).toEqual([2]);
    });

    it('emits no stepChange when a sync guard refuses', () => {
        const changes: number[] = [];
        stepper.stepChange.subscribe(i => changes.push(i));
        host.guard.set(() => false);
        fixture.detectChanges();

        stepper.nextStep();

        expect(changes).toEqual([]);
    });

    it('emits stepBlocked and no stepChange when an async guard resolves false', async () => {
        const changes: number[] = [];
        const blocked: { from: number; to: number }[] = [];
        stepper.stepChange.subscribe(i => changes.push(i));
        stepper.stepBlocked.subscribe(e => blocked.push(e));
        host.guard.set(() => Promise.resolve(false));
        fixture.detectChanges();

        stepper.nextStep();
        await fixture.whenStable();

        expect(changes).toEqual([]);
        expect(blocked).toEqual([{ from: 0, to: 1 }]);
    });

    it('emits stepBlocked and no stepChange when an async guard rejects', async () => {
        const changes: number[] = [];
        const blocked: { from: number; to: number }[] = [];
        stepper.stepChange.subscribe(i => changes.push(i));
        stepper.stepBlocked.subscribe(e => blocked.push(e));
        host.guard.set(() => Promise.reject(new Error('server said no')));
        fixture.detectChanges();

        stepper.nextStep();
        await fixture.whenStable();

        expect(changes).toEqual([]);
        expect(blocked).toEqual([{ from: 0, to: 1 }]);
    });

    it('runs the guard for backward moves too, so the guard can decide', () => {
        stepper.activeStep.set(2);
        const seen: { from: number; to: number }[] = [];
        host.guard.set((from, to) => { seen.push({ from, to }); return to > from; });
        fixture.detectChanges();

        stepper.prevStep();

        expect(seen).toEqual([{ from: 2, to: 1 }]);
        expect(stepper.activeStep()).toBe(2);
    });

});

describe('StepperComponent — canLeave and linear together', () => {
    it('rejects on the linear gate without ever consulting the guard', () => {
        TestBed.configureTestingModule({ imports: [LinearGuardHostComponent] });
        const fixture = TestBed.createComponent(LinearGuardHostComponent);
        fixture.detectChanges();
        const stepper = fixture.debugElement.children[0].componentInstance as StepperComponent;

        stepper.goToStep(2);

        expect(fixture.componentInstance.calls).toBe(0);
        expect(stepper.activeStep()).toBe(0);
    });
});
