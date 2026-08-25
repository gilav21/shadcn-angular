// `time-picker` — `specs/form-controls-small-spec.md` T-3, UC-1, UC-2, R-2, R-3.
//
// Every assertion here goes through the DOM. The `currency-input` round taught
// that a test calling `onBlur()` directly proves the method works and says
// nothing about whether anything ever calls it.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal, type ModelSignal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { TimePickerComponent } from './time-picker.component';
import type { TimeSegmentKind } from './time-picker.format';

@Component({
    standalone: true,
    imports: [TimePickerComponent],
    template: `
    <ui-time-picker
      [(value)]="time"
      [locale]="locale()"
      [withSeconds]="withSeconds()"
      [disabled]="disabled()"
    />
  `,
})
class HostComponent {
    readonly time = signal<string | null>(null);
    readonly locale = signal('en-US');
    readonly withSeconds = signal(false);
    readonly disabled = signal(false);
}

@Component({
    standalone: true,
    imports: [TimePickerComponent, ReactiveFormsModule],
    template: `<ui-time-picker [formControl]="control" locale="en-GB" />`,
})
class ReactiveHostComponent {
    readonly control = new FormControl<string | null>(null);
}

describe('TimePickerComponent', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;

    function segments(): HTMLInputElement[] {
        return [...fixture.nativeElement.querySelectorAll('[data-slot="time-picker-segment"]')];
    }

    function segment(kind: TimeSegmentKind): HTMLInputElement {
        return fixture.nativeElement.querySelector(
            `[data-slot="time-picker-segment"][data-segment="${kind}"]`,
        );
    }

    function period(): HTMLButtonElement | null {
        return fixture.nativeElement.querySelector('[data-slot="time-picker-period"]');
    }

    async function settle(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    }

    async function typeInto(kind: TimeSegmentKind, text: string): Promise<void> {
        const field = segment(kind);
        field.value = text;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        await settle();
    }

    async function press(kind: TimeSegmentKind, key: string): Promise<void> {
        segment(kind).dispatchEvent(
            new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
        );
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
        it('exposes value as a model signal', () => {
            const control = fixture.debugElement.children[0]
                .componentInstance as TimePickerComponent;
            const value: ModelSignal<string | null> = control.value;

            expect(typeof value.set).toBe('function');
            expect(typeof value.subscribe).toBe('function');
        });

        it('emits through the two-way binding on a user edit', async () => {
            await typeInto('hour', '9');
            await typeInto('minute', '5');
            expect(host.time()).toBe('09:05');
        });

        /** Risk R-3 — a form writing in must not look like a user typing. */
        it('does NOT emit when a value is written in from outside', async () => {
            const control = fixture.debugElement.children[0]
                .componentInstance as TimePickerComponent;
            let emissions = 0;
            control.value.subscribe(() => emissions++);

            control.writeValue('14:30');
            await settle();

            expect(emissions).toBe(0);
        });
    });

    describe('the value is HH:mm, 24-hour', () => {
        it('stores 24-hour even when it renders 12-hour', async () => {
            await typeInto('hour', '9');
            await typeInto('minute', '5');
            period()!.click();
            await settle();

            expect(host.time()).toBe('21:05');
        });

        /** UC-2: the same instant, entered in two locales, is one value. */
        it('is the same string whichever locale entered it', async () => {
            await typeInto('hour', '9');
            await typeInto('minute', '5');
            period()!.click();
            await settle();
            const american = host.time();

            host.locale.set('de-DE');
            host.time.set(null);
            await settle();
            await typeInto('hour', '21');
            await typeInto('minute', '5');

            expect(host.time()).toBe(american);
        });

        it('widens to HH:mm:ss only when asked', async () => {
            host.withSeconds.set(true);
            await settle();
            await typeInto('hour', '9');
            await typeInto('minute', '5');
            await typeInto('second', '9');

            expect(host.time()).toBe('09:05:09');
        });

        it('renders a written value across its segments', async () => {
            host.time.set('14:30');
            await settle();

            expect(segment('hour').value).toBe('2');
            expect(segment('minute').value).toBe('30');
            expect(period()!.textContent!.trim()).toBe('PM');
        });

        it('ignores a value that is not a time', async () => {
            host.time.set('25:99');
            await settle();
            expect(segments().every(field => field.value === '')).toBe(true);
        });
    });

    /**
     * An hour with no minute is not a time. The value staying null is what
     * `<input type="time">` does; the *digit surviving* is the part that broke
     * first — the null commit echoed back through the model and wiped it.
     */
    describe('an incomplete entry', () => {
        it('holds no value until both hour and minute are set', async () => {
            await typeInto('hour', '9');
            expect(host.time()).toBeNull();
        });

        it('keeps the digit that was typed', async () => {
            await typeInto('hour', '9');
            expect(segment('hour').value).toBe('9');
        });

        it('produces a value as soon as the minute arrives', async () => {
            await typeInto('hour', '9');
            await typeInto('minute', '5');
            expect(host.time()).toBe('09:05');
        });

        it('goes back to no value when a segment is emptied', async () => {
            host.time.set('09:05');
            await settle();
            await typeInto('minute', '');

            expect(host.time()).toBeNull();
        });
    });

    describe('what the locale decides', () => {
        it('shows a meridiem in a 12-hour locale and not in a 24-hour one', async () => {
            expect(period()).not.toBeNull();

            host.locale.set('en-GB');
            await settle();
            expect(period()).toBeNull();
        });

        it('shows 24-hour digits in a 24-hour locale', async () => {
            host.locale.set('en-GB');
            host.time.set('14:30');
            await settle();

            expect(segment('hour').value).toBe('14');
        });

        /**
         * R-2, corrected by measurement: h:m:s never reorders, but zh-TW puts
         * the meridiem first (下午9:05). That is what a hard-coded layout gets
         * wrong, so it is asserted on DOM order rather than on a data array.
         */
        it('puts the meridiem where the locale puts it, in the DOM', async () => {
            const slots = (): string[] =>
                [
                    ...fixture.nativeElement.querySelectorAll(
                        '[data-slot="time-picker-segment"],[data-slot="time-picker-period"]',
                    ),
                ].map((el: HTMLElement) => el.dataset['segment'] ?? 'dayPeriod');

            expect(slots()).toEqual(['hour', 'minute', 'dayPeriod']);

            host.locale.set('zh-TW');
            await settle();
            expect(slots()).toEqual(['dayPeriod', 'hour', 'minute']);
        });

        it('names the halves of the day as the locale names them', async () => {
            host.time.set('21:05');
            host.locale.set('ar-EG');
            await settle();

            expect(period()!.textContent!.trim()).toBe('م');
        });

        /** R-1: an Arabic locale renders Arabic-Indic digits. */
        it('renders the locale’s own digits', async () => {
            host.locale.set('ar-EG');
            host.time.set('09:05');
            await settle();

            expect(segment('minute').value).toBe('٠٥');
        });

        it('reads back the digits it rendered', async () => {
            host.locale.set('ar-EG');
            await settle();
            await typeInto('hour', '٩');
            await typeInto('minute', '٣٠');

            expect(host.time()).toBe('09:30');
        });

        /**
         * No locale reads a clock right-to-left, so the group is explicitly
         * LTR — otherwise an RTL page renders 23:05 as 05:23.
         */
        it('lays the segments out left-to-right whatever the page does', () => {
            const group = fixture.nativeElement.querySelector('[data-slot="time-picker"]');
            expect(group.getAttribute('dir')).toBe('ltr');
        });
    });

    describe('typing', () => {
        it('clamps an hour above the maximum', async () => {
            host.locale.set('en-GB');
            await settle();
            await typeInto('hour', '99');
            await typeInto('minute', '0');

            expect(host.time()).toBe('23:00');
        });

        it('clamps a minute above the maximum', async () => {
            await typeInto('hour', '9');
            await typeInto('minute', '99');
            expect(host.time()).toBe('09:59');
        });

        it('ignores characters that are not digits', async () => {
            await typeInto('hour', '9');
            await typeInto('minute', '3a0');
            expect(host.time()).toBe('09:30');
        });
    });

    describe('arrow keys', () => {
        it('steps a segment up and down', async () => {
            host.time.set('09:05');
            await settle();

            await press('minute', 'ArrowUp');
            expect(host.time()).toBe('09:06');

            await press('minute', 'ArrowDown');
            expect(host.time()).toBe('09:05');
        });

        it('wraps a minute rather than sticking at 59', async () => {
            host.time.set('09:59');
            await settle();
            await press('minute', 'ArrowUp');

            expect(host.time()).toBe('09:00');
        });

        /** A 12-hour hour runs 1–12, so it wraps to 1 rather than to 0. */
        it('wraps a 12-hour hour from 12 to 1', async () => {
            host.time.set('12:00');
            await settle();
            await press('hour', 'ArrowUp');

            expect(segment('hour').value).toBe('1');
            expect(host.time()).toBe('13:00');
        });

        it('wraps a 24-hour hour from 23 to 0', async () => {
            host.locale.set('en-GB');
            host.time.set('23:00');
            await settle();
            await press('hour', 'ArrowUp');

            expect(host.time()).toBe('00:00');
        });

        it('does not take a key it does not handle', async () => {
            host.time.set('09:05');
            await settle();
            await press('minute', 'a');

            expect(host.time()).toBe('09:05');
        });
    });

    describe('the meridiem', () => {
        it('flips the stored hour by twelve', async () => {
            host.time.set('09:05');
            await settle();

            period()!.click();
            await settle();
            expect(host.time()).toBe('21:05');

            period()!.click();
            await settle();
            expect(host.time()).toBe('09:05');
        });

        it('flips on an arrow key too, so the field is keyboard-drivable', async () => {
            host.time.set('09:05');
            await settle();

            period()!.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }),
            );
            await settle();

            expect(host.time()).toBe('21:05');
        });

        /** Midnight and noon are the readings a naive fold gets wrong. */
        it('handles midnight and noon', async () => {
            host.time.set('00:30');
            await settle();
            expect(segment('hour').value).toBe('12');
            expect(period()!.textContent!.trim()).toBe('AM');

            period()!.click();
            await settle();
            expect(host.time()).toBe('12:30');
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
            reactive.componentInstance.control.setValue('14:30');
            reactive.detectChanges();
            await reactive.whenStable();
            reactive.detectChanges();

            const hour: HTMLInputElement = reactive.nativeElement.querySelector(
                '[data-segment="hour"]',
            );
            expect(hour.value).toBe('14');
        });

        it('disables every segment when the form disables the control', async () => {
            reactive.componentInstance.control.disable();
            reactive.detectChanges();
            await reactive.whenStable();
            reactive.detectChanges();

            const fields: HTMLInputElement[] = [
                ...reactive.nativeElement.querySelectorAll('[data-slot="time-picker-segment"]'),
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
                '[data-slot="time-picker-segment"]',
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
            const group = fixture.nativeElement.querySelector('[data-slot="time-picker"]');
            // A native fieldset, not a div wearing a group role.
            expect(group.tagName).toBe('FIELDSET');
            expect(group.getAttribute('aria-label')).toBe('Time');
        });

        it('makes every numeric segment a spinbutton', () => {
            expect(segments().every(field => field.getAttribute('role') === 'spinbutton')).toBe(
                true,
            );
        });

        it('bounds an hour by what the locale allows', async () => {
            expect(segment('hour').getAttribute('aria-valuemin')).toBe('1');
            expect(segment('hour').getAttribute('aria-valuemax')).toBe('12');

            host.locale.set('en-GB');
            await settle();
            expect(segment('hour').getAttribute('aria-valuemin')).toBe('0');
            expect(segment('hour').getAttribute('aria-valuemax')).toBe('23');
        });

        it('names the meridiem button', () => {
            expect(period()!.getAttribute('aria-label')).toBe('AM or PM');
        });

        it('keeps the meridiem out of the tab order of a 24-hour locale', async () => {
            host.locale.set('en-GB');
            await settle();
            expect(period()).toBeNull();
        });

        it('asks for a numeric keypad without being a number field', () => {
            expect(segments().every(field => field.getAttribute('type') === 'text')).toBe(true);
            expect(segments().every(field => field.getAttribute('inputmode') === 'numeric')).toBe(
                true,
            );
        });

        it('is disabled by the input', async () => {
            host.disabled.set(true);
            await settle();

            expect(segments().every(field => field.disabled)).toBe(true);
            expect(period()!.disabled).toBe(true);
        });
    });
});
