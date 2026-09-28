// `duration-input` — `specs/form-controls-small-spec.md` T-2.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { DurationInputComponent } from './duration-input.component';
import type { DurationUnit } from './duration-input.format';

/**
 * The group's accessible description as a screen reader resolves it: the text
 * of every element its `aria-describedby` points at, in order. Whitespace is
 * collapsed to plain spaces because `Intl` puts a narrow no-break space before
 * "PM" in newer ICU versions, and a reader treats it as a space.
 */
function describedText(group: HTMLElement): string {
    const ids = (group.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
    return ids
        .map(id => group.ownerDocument.getElementById(id)?.textContent ?? '')
        .join(' ')
        .replaceAll(/\s+/g, ' ')
        .trim();
}

@Component({
    standalone: true,
    imports: [DurationInputComponent],
    template: `
    <ui-duration-input
      [(value)]="duration"
      [units]="units()"
      [locale]="locale()"
      [disabled]="disabled()"
    />
  `,
})
class HostComponent {
    readonly duration = signal<number | null>(null);
    readonly units = signal<readonly DurationUnit[]>(['hours', 'minutes']);
    readonly locale = signal('en-US');
    readonly disabled = signal(false);
}

@Component({
    standalone: true,
    imports: [DurationInputComponent, ReactiveFormsModule],
    template: `<ui-duration-input [formControl]="control" />`,
})
class ReactiveHostComponent {
    readonly control = new FormControl<number | null>(null);
}

describe('DurationInputComponent', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;

    function segments(): HTMLInputElement[] {
        return [...fixture.nativeElement.querySelectorAll('[data-slot="duration-input-segment"]')];
    }

    function segment(unit: DurationUnit): HTMLInputElement {
        return fixture.nativeElement.querySelector(
            `[data-slot="duration-input-segment"][data-unit="${unit}"]`,
        );
    }

    async function settle(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    }

    async function typeInto(unit: DurationUnit, text: string): Promise<void> {
        const field = segment(unit);
        field.value = text;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        await settle();
    }

    async function press(unit: DurationUnit, key: string): Promise<void> {
        segment(unit).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        await settle();
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        host = fixture.componentInstance;
        await settle();
    });

    afterEach(() => fixture.destroy());

    describe('the conformance contract', () => {
        it('emits through the two-way binding on a user edit', async () => {
            await typeInto('minutes', '30');
            expect(host.duration()).toBe(1800);
        });

        /** Risk R-3 — a form writing in must not look like a user typing. */
        it('does NOT emit when a value is written in from outside', async () => {
            const control = fixture.debugElement.children[0]
                .componentInstance as DurationInputComponent;
            let emissions = 0;
            control.value.subscribe(() => emissions++);

            control.writeValue(5400);
            await settle();

            expect(emissions).toBe(0);
        });
    });

    describe('rendering', () => {
        it('shows one segment per unit', () => {
            expect(segments().map(field => field.dataset['unit'])).toEqual(['hours', 'minutes']);
        });

        it('shows the units it was asked for', async () => {
            host.units.set(['hours', 'minutes', 'seconds']);
            await settle();
            expect(segments().map(field => field.dataset['unit'])).toEqual(['hours', 'minutes', 'seconds']);
        });

        it('starts empty for a null value', () => {
            expect(segments().every(field => field.value === '')).toBe(true);
        });

        it('splits a duration across its segments', async () => {
            host.duration.set(5400);
            await settle();

            expect(segment('hours').value).toBe('1');
            expect(segment('minutes').value).toBe('30');
        });

        it('pads every segment but the first', async () => {
            host.duration.set(3605);
            host.units.set(['hours', 'minutes', 'seconds']);
            await settle();

            expect(segment('hours').value).toBe('1');
            expect(segment('minutes').value).toBe('00');
            expect(segment('seconds').value).toBe('05');
        });

        /**
         * A field showing only minutes has to render 90 minutes as 90, not
         * drop an hour it cannot display.
         */
        it('lets the leading segment absorb everything above it', async () => {
            host.units.set(['minutes', 'seconds']);
            host.duration.set(5400);
            await settle();

            expect(segment('minutes').value).toBe('90');
        });
    });

    describe('typing', () => {
        it('adds up across segments', async () => {
            await typeInto('hours', '1');
            await typeInto('minutes', '30');
            expect(host.duration()).toBe(5400);
        });

        it('ignores characters that are not digits', async () => {
            await typeInto('minutes', '3a0');
            expect(host.duration()).toBe(1800);
        });

        it('treats an emptied segment as zero', async () => {
            host.duration.set(5400);
            await settle();
            await typeInto('minutes', '');

            expect(host.duration()).toBe(3600);
        });
    });

    describe('arrow keys', () => {
        it('steps a segment up and down', async () => {
            host.duration.set(3600);
            await settle();

            await press('minutes', 'ArrowUp');
            expect(host.duration()).toBe(3660);

            await press('minutes', 'ArrowDown');
            expect(host.duration()).toBe(3600);
        });

        /**
         * Stepping 59 up should read 0, not sit at 59 — the latter looks like
         * the control has stopped responding.
         */
        it('wraps a bounded segment rather than sticking', async () => {
            host.duration.set(3600 + 59 * 60);
            await settle();
            await press('minutes', 'ArrowUp');

            expect(segment('minutes').value).toBe('00');
        });

        it('does not take a key it does not handle', async () => {
            host.duration.set(3600);
            await settle();
            const control = fixture.debugElement.children[0].componentInstance as DurationInputComponent;
            let emissions = 0;
            control.value.subscribe(() => emissions++);

            const key = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
            const notCancelled = segment('minutes').dispatchEvent(key);
            await settle();

            expect(notCancelled).toBe(true);
            expect(emissions).toBe(0);
            expect(host.duration()).toBe(3600);
        });

        it('never steps below zero', async () => {
            host.duration.set(0);
            await settle();
            await press('hours', 'ArrowDown');

            expect(host.duration()).toBe(0);
        });
    });

    describe('a reactive form', () => {
        let reactive: ComponentFixture<ReactiveHostComponent>;

        beforeEach(async () => {
            await TestBed.resetTestingModule();
            await TestBed.configureTestingModule({
                imports: [ReactiveHostComponent],
            }).compileComponents();
            reactive = TestBed.createComponent(ReactiveHostComponent);
            reactive.detectChanges();
            await reactive.whenStable();
            reactive.detectChanges();
        });

        afterEach(() => reactive.destroy());

        it('renders what the control holds', async () => {
            reactive.componentInstance.control.setValue(5400);
            reactive.detectChanges();
            await reactive.whenStable();
            reactive.detectChanges();

            const hours: HTMLInputElement = reactive.nativeElement.querySelector(
                '[data-unit="hours"]',
            );
            expect(hours.value).toBe('1');
        });

        it('disables every segment when the form disables the control', async () => {
            reactive.componentInstance.control.disable();
            reactive.detectChanges();
            await reactive.whenStable();
            reactive.detectChanges();

            const fields: HTMLInputElement[] = [
                ...reactive.nativeElement.querySelectorAll('[data-slot="duration-input-segment"]'),
            ];
            expect(fields.every(field => field.disabled)).toBe(true);
        });

        /**
         * A real blur, not a direct call — `blur` does not bubble, so a
         * handler bound on the wrong element never runs. Three shipped
         * controls had exactly that bug.
         */
        it('marks the control touched on a real blur', async () => {
            const field: HTMLInputElement = reactive.nativeElement.querySelector(
                '[data-slot="duration-input-segment"]',
            );
            expect(reactive.componentInstance.control.touched).toBe(false);

            field.focus();
            field.blur();
            reactive.detectChanges();
            await reactive.whenStable();

            expect(reactive.componentInstance.control.touched).toBe(true);
        });
    });

    describe('accessibility', () => {
        it('is a named group', () => {
            const group = fixture.nativeElement.querySelector('[data-slot="duration-input"]');
            // A native fieldset, not a div wearing a group role.
            expect(group.tagName).toBe('FIELDSET');
            expect(group.getAttribute('aria-label')).toBe('Duration');
        });

        it('makes every segment a spinbutton', () => {
            expect(segments().every(field => field.getAttribute('role') === 'spinbutton')).toBe(true);
        });

        /**
         * The segments each announce only their own unit; the group's
         * description is where the whole value is heard — and it has to follow
         * the value, zero included (a zero duration is a value, not an empty one).
         */
        it('describes the group with the whole current value, following edits', async () => {
            const group: HTMLElement = fixture.nativeElement.querySelector('[data-slot="duration-input"]');
            host.duration.set(5400);
            await settle();
            expect(describedText(group)).toBe('1 hour, 30 minutes');

            await typeInto('minutes', '5');
            expect(describedText(group)).toBe('1 hour, 5 minutes');

            host.duration.set(0);
            await settle();
            expect(describedText(group)).toBe('0 minutes');

            host.locale.set('fr');
            host.duration.set(9000);
            await settle();
            expect(describedText(group)).toBe('2 heures et 30 minutes');
        });

        /** So a reader says "30 minutes" rather than "30". */
        it('names the unit in each segment’s value text', async () => {
            host.duration.set(5400);
            await settle();

            expect(segment('minutes').getAttribute('aria-valuetext')).toBe('30 minutes');
            expect(segment('hours').getAttribute('aria-valuetext')).toBe('1 hour');
            expect(segment('hours').getAttribute('aria-valuenow')).toBe('1');
        });

        it('caps a following segment at 59 but not the leading one', async () => {
            host.units.set(['minutes', 'seconds']);
            await settle();

            expect(segment('seconds').getAttribute('aria-valuemax')).toBe('59');
            expect(segment('minutes').getAttribute('aria-valuemax')).toBe(
                String(Number.MAX_SAFE_INTEGER),
            );
        });

        it('asks for a numeric keypad without being a number field', () => {
            expect(segments().every(field => field.getAttribute('type') === 'text')).toBe(true);
            expect(segments().every(field => field.getAttribute('inputmode') === 'numeric')).toBe(true);
        });

        it('is disabled by the input', async () => {
            host.disabled.set(true);
            await settle();
            expect(segments().every(field => field.disabled)).toBe(true);
        });
    });
});
