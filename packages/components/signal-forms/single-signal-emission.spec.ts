/**
 * T-9 and T-10 for the four controls converted by promoting an internal
 * `signal()` straight to a `model()` — `input`, `textarea`, `rating` and
 * `input-group-input`.
 *
 * These four deliberately skip the two-signal shape of §3.5.a, because none of
 * them had a `valueChange` output before the conversion: there was no contract
 * promising silence on a programmatic write, so the model is the single source
 * of truth and a form write keeps a `[(value)]` binding in step instead of
 * letting it drift. That decision was argued in prose; this file is the part
 * that actually checks it, because the consequence — a `writeValue` *does*
 * reach the new output — is exactly the sort of thing that should be pinned
 * rather than assumed.
 *
 * What T-10 requires of them is unchanged: a write of the value the control
 * already holds must emit nothing at all.
 */
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, expect, it } from 'vitest';

import { InputComponent } from '../ui/input';
import { InputGroupInputComponent } from '../ui/input-group';
import { RatingComponent } from '../ui/rating';
import { TextareaComponent } from '../ui/textarea';

@Component({
    template: `<ui-input [(value)]="text" (valueChange)="emissions.push($event)" />`,
    imports: [InputComponent],
})
class InputEmissionHost {
    readonly text = signal('');
    readonly emissions: string[] = [];
}

@Component({
    template: `<ui-textarea [(value)]="text" (valueChange)="emissions.push($event)" />`,
    imports: [TextareaComponent],
})
class TextareaEmissionHost {
    readonly text = signal('');
    readonly emissions: string[] = [];
}

@Component({
    template: `<ui-rating [(value)]="score" (valueChange)="emissions.push($event)" (ratingChange)="ratingEmissions.push($event)" />`,
    imports: [RatingComponent],
})
class RatingEmissionHost {
    readonly score = signal(0);
    readonly emissions: number[] = [];
    readonly ratingEmissions: number[] = [];
}

@Component({
    template: `<ui-input-group-input [(value)]="text" (valueChange)="emissions.push($event)" />`,
    imports: [InputGroupInputComponent],
})
class InputGroupEmissionHost {
    readonly text = signal('');
    readonly emissions: string[] = [];
}

/**
 * Drives a real edit: set the element's value and dispatch the same `input`
 * event a keystroke produces, so the assertion rides the component's actual
 * `ngModel` wiring rather than a hand-called handler. A test that calls the
 * handler directly is testing its own arrangement, not the behaviour.
 */
const typeInto = async (
    fixture: ComponentFixture<unknown>,
    selector: string,
    text: string,
): Promise<void> => {
    const el: HTMLInputElement | HTMLTextAreaElement =
        fixture.debugElement.query(By.css(selector)).nativeElement;
    el.value = text;
    el.dispatchEvent(new Event('input'));
    await settle(fixture);
};

const settle = async (fixture: ComponentFixture<unknown>): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
};

describe('T-9/T-10: input (single-signal conversion)', () => {
    const control = (fixture: ComponentFixture<unknown>): InputComponent =>
        fixture.debugElement.query(By.directive(InputComponent)).componentInstance;

    it('T-9: emits exactly once per user edit', async () => {
        const fixture = TestBed.createComponent(InputEmissionHost);
        await settle(fixture);

        await typeInto(fixture, 'input', 'typed');

        expect(fixture.componentInstance.emissions).toEqual(['typed']);
    });

    it('T-10: a writeValue of the value already held emits nothing', async () => {
        const fixture = TestBed.createComponent(InputEmissionHost);
        await settle(fixture);
        await typeInto(fixture, 'input', 'typed');
        fixture.componentInstance.emissions.length = 0;

        control(fixture).writeValue('typed');
        await settle(fixture);

        expect(fixture.componentInstance.emissions).toEqual([]);
    });

    it('a writeValue of a new value emits once and keeps the binding in step', async () => {
        const fixture = TestBed.createComponent(InputEmissionHost);
        await settle(fixture);
        fixture.componentInstance.emissions.length = 0;

        control(fixture).writeValue('from the form');
        await settle(fixture);

        expect(fixture.componentInstance.emissions).toEqual(['from the form']);
        expect(fixture.componentInstance.text()).toBe('from the form');
    });
});

describe('T-9/T-10: textarea (single-signal conversion)', () => {
    const control = (fixture: ComponentFixture<unknown>): TextareaComponent =>
        fixture.debugElement.query(By.directive(TextareaComponent)).componentInstance;

    it('T-9: emits exactly once per user edit', async () => {
        const fixture = TestBed.createComponent(TextareaEmissionHost);
        await settle(fixture);

        await typeInto(fixture, 'textarea', 'typed');

        expect(fixture.componentInstance.emissions).toEqual(['typed']);
    });

    it('T-10: a writeValue of the value already held emits nothing', async () => {
        const fixture = TestBed.createComponent(TextareaEmissionHost);
        await settle(fixture);
        await typeInto(fixture, 'textarea', 'typed');
        fixture.componentInstance.emissions.length = 0;

        control(fixture).writeValue('typed');
        await settle(fixture);

        expect(fixture.componentInstance.emissions).toEqual([]);
    });

    it('a writeValue of a new value emits once and keeps the binding in step', async () => {
        const fixture = TestBed.createComponent(TextareaEmissionHost);
        await settle(fixture);
        fixture.componentInstance.emissions.length = 0;

        control(fixture).writeValue('from the form');
        await settle(fixture);

        expect(fixture.componentInstance.emissions).toEqual(['from the form']);
        expect(fixture.componentInstance.text()).toBe('from the form');
    });
});

describe('T-9/T-10: rating (single-signal conversion)', () => {
    const control = (fixture: ComponentFixture<unknown>): RatingComponent =>
        fixture.debugElement.query(By.directive(RatingComponent)).componentInstance;

    it('T-9: a user pick emits valueChange once, and ratingChange once', async () => {
        const fixture = TestBed.createComponent(RatingEmissionHost);
        await settle(fixture);

        control(fixture).onKeydown(new KeyboardEvent('keydown', { key: 'End' }));
        await settle(fixture);

        expect(fixture.componentInstance.emissions).toEqual([5]);
        expect(fixture.componentInstance.ratingEmissions).toEqual([5]);
    });

    it('T-10: a writeValue of the value already held emits nothing', async () => {
        const fixture = TestBed.createComponent(RatingEmissionHost);
        await settle(fixture);
        control(fixture).onKeydown(new KeyboardEvent('keydown', { key: 'End' }));
        await settle(fixture);
        fixture.componentInstance.emissions.length = 0;
        fixture.componentInstance.ratingEmissions.length = 0;

        control(fixture).writeValue(5);
        await settle(fixture);

        expect(fixture.componentInstance.emissions).toEqual([]);
        expect(fixture.componentInstance.ratingEmissions).toEqual([]);
    });

    it('a form write reaches valueChange but never ratingChange', async () => {
        const fixture = TestBed.createComponent(RatingEmissionHost);
        await settle(fixture);
        fixture.componentInstance.emissions.length = 0;

        control(fixture).writeValue(3);
        await settle(fixture);

        expect(fixture.componentInstance.emissions).toEqual([3]);
        expect(fixture.componentInstance.ratingEmissions).toEqual([]);
    });
});

describe('T-9/T-10: input-group-input (single-signal conversion)', () => {
    const control = (fixture: ComponentFixture<unknown>): InputGroupInputComponent =>
        fixture.debugElement.query(By.directive(InputGroupInputComponent)).componentInstance;

    it('T-9: emits exactly once per user edit', async () => {
        const fixture = TestBed.createComponent(InputGroupEmissionHost);
        await settle(fixture);

        await typeInto(fixture, 'input', 'typed');

        expect(fixture.componentInstance.emissions).toEqual(['typed']);
    });

    it('T-10: a writeValue of the value already held emits nothing', async () => {
        const fixture = TestBed.createComponent(InputGroupEmissionHost);
        await settle(fixture);
        await typeInto(fixture, 'input', 'typed');
        fixture.componentInstance.emissions.length = 0;

        control(fixture).writeValue('typed');
        await settle(fixture);

        expect(fixture.componentInstance.emissions).toEqual([]);
    });

    it('a writeValue of a new value emits once and keeps the binding in step', async () => {
        const fixture = TestBed.createComponent(InputGroupEmissionHost);
        await settle(fixture);
        fixture.componentInstance.emissions.length = 0;

        control(fixture).writeValue('from the form');
        await settle(fixture);

        expect(fixture.componentInstance.emissions).toEqual(['from the form']);
        expect(fixture.componentInstance.text()).toBe('from the form');
    });
});
