import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { InputOTPComponent } from './input-otp.component';

/**
 * Browser-only: selection-based typing, Tab order, paste and the RTL layout all
 * depend on native text editing and real geometry, which jsdom does not do.
 */
@Component({
    template: `
        <div [dir]="dir()">
            <button type="button" data-testid="before">before</button>
            <ui-input-otp [(value)]="code" (valueChange)="emissions.push($event)" />
            <button type="button" data-testid="after">after</button>
        </div>
    `,
    imports: [InputOTPComponent],
})
class OtpHost {
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
    readonly code = signal('');
    readonly emissions: string[] = [];
}

function mount(initial = '', dir: 'ltr' | 'rtl' = 'ltr'): ComponentFixture<OtpHost> {
    const fixture = TestBed.createComponent(OtpHost);
    fixture.componentInstance.code.set(initial);
    fixture.componentInstance.dir.set(dir);
    fixture.detectChanges();
    return fixture;
}

const root = (fixture: ComponentFixture<unknown>): HTMLElement => fixture.nativeElement;
const hidden = (fixture: ComponentFixture<unknown>): HTMLInputElement => root(fixture).querySelector('input')!;
const slots = (fixture: ComponentFixture<unknown>): HTMLElement[] =>
    Array.from(root(fixture).querySelectorAll('[data-slot="input-otp-slot"]'));
const activeSlot = (fixture: ComponentFixture<unknown>): number =>
    slots(fixture).findIndex(slot => slot.hasAttribute('data-active'));
const testId = (fixture: ComponentFixture<unknown>, id: string): HTMLElement =>
    root(fixture).querySelector(`[data-testid="${id}"]`)!;

describe('InputOTPComponent keyboard model (browser)', () => {
    it('typing lands in the highlighted slot after arrows and after a slot click', async () => {
        const typed = mount();
        await userEvent.click(slots(typed)[0]);
        await userEvent.keyboard('123{ArrowLeft}{ArrowLeft}9');
        typed.detectChanges();
        expect(hidden(typed).value).toBe('193');
        expect(typed.componentInstance.code()).toBe('193');
        expect(activeSlot(typed)).toBe(2);

        const full = mount('123456');
        await userEvent.click(slots(full)[2]);
        full.detectChanges();
        expect(activeSlot(full)).toBe(2);
        await userEvent.keyboard('9');
        full.detectChanges();
        expect(hidden(full).value).toBe('129456');
        expect(activeSlot(full)).toBe(3);

        const partial = mount('12');
        await userEvent.click(slots(partial)[5]);
        partial.detectChanges();
        expect(activeSlot(partial)).toBe(2);
        await userEvent.keyboard('3');
        partial.detectChanges();
        expect(hidden(partial).value).toBe('123');

        const rejected = mount('123');
        await userEvent.click(slots(rejected)[1]);
        await userEvent.keyboard('!');
        rejected.detectChanges();
        expect(hidden(rejected).value).toBe('123');
        expect(rejected.componentInstance.emissions).toEqual([]);
        expect(activeSlot(rejected)).toBe(1);
    });

    it('Backspace, Home and End move the highlight with the real caret, and an outside write re-aims it', async () => {
        const fixture = mount('123');
        await userEvent.click(slots(fixture)[1]);
        await userEvent.keyboard('{Backspace}');
        fixture.detectChanges();
        expect(hidden(fixture).value).toBe('13');
        expect(activeSlot(fixture)).toBe(1);

        await userEvent.keyboard('{End}');
        fixture.detectChanges();
        expect(activeSlot(fixture)).toBe(2);
        await userEvent.keyboard('{Home}9');
        fixture.detectChanges();
        expect(hidden(fixture).value).toBe('93');

        // a reset to a shorter code than the caret's position
        fixture.componentInstance.code.set('');
        fixture.detectChanges();
        await fixture.whenStable();
        expect(activeSlot(fixture)).toBe(0);
        await userEvent.keyboard('8');
        fixture.detectChanges();
        expect(hidden(fixture).value).toBe('8');
    });

    it('renders slot 0 leftmost and maps arrows physically in an RTL page', async () => {
        const fixture = mount('123', 'rtl');
        const all = slots(fixture);
        const left = (el: HTMLElement): number => el.getBoundingClientRect().left;

        expect(left(all[0])).toBeLessThan(left(all[1]));
        const readingOrder = [...all].sort((a, b) => left(a) - left(b)).map(slot => slot.textContent?.trim());
        expect(readingOrder.slice(0, 3)).toEqual(['1', '2', '3']);

        await userEvent.click(all[2]);
        fixture.detectChanges();
        const before = left(all[activeSlot(fixture)]);
        await userEvent.keyboard('{ArrowLeft}');
        fixture.detectChanges();
        expect(activeSlot(fixture)).toBe(1);
        expect(left(all[activeSlot(fixture)])).toBeLessThan(before);
    });

    it.each(['ltr', 'rtl'] as const)('rounds the outer corners of each group of slots by physical side (%s)', dir => {
        const fixture = mount('', dir);
        const radius = (slot: HTMLElement, corner: string): number =>
            Number.parseFloat(getComputedStyle(slot).getPropertyValue(`border-${corner}-radius`));
        const all = slots(fixture);

        // default separator [2]: groups are slots 0-2 and 3-5
        expect(all.map(slot => radius(slot, 'top-left') > 0)).toEqual([true, false, false, true, false, false]);
        expect(all.map(slot => radius(slot, 'top-right') > 0)).toEqual([false, false, true, false, false, true]);
    });

    it('is a single tab stop', async () => {
        const fixture = mount('12');
        for (const slot of slots(fixture)) {
            expect(slot.hasAttribute('tabindex')).toBe(false);
            expect(slot.getAttribute('aria-hidden')).toBe('true');
        }

        await userEvent.click(testId(fixture, 'before'));
        await userEvent.tab();
        expect(document.activeElement).toBe(hidden(fixture));
        await userEvent.tab();
        expect(document.activeElement).toBe(testId(fixture, 'after'));
    });

    it('focusing a full code highlights the last slot and typing replaces it', async () => {
        const fixture = mount('123456');
        await userEvent.click(testId(fixture, 'before'));
        await userEvent.tab();
        fixture.detectChanges();

        expect(activeSlot(fixture)).toBe(5);
        await userEvent.keyboard('7');
        fixture.detectChanges();
        expect(hidden(fixture).value).toBe('123457');
    });
});

describe('InputOTPComponent paste (browser)', () => {
    const paste = (fixture: ComponentFixture<unknown>, text: string): void => {
        const data = new DataTransfer();
        data.setData('text/plain', text);
        hidden(fixture).dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
        fixture.detectChanges();
    };

    it.each([
        ['an empty field', '', '987654', '987654', 5],
        ['a partly filled field', '123', '987654', '987654', 5],
        ['a full field', '123456', '987654', '987654', 5],
        ['a code with a dash and a space', '', 'ab-12 34', 'AB1234', 5],
        ['a code longer than the field', '', '12345678', '123456', 5],
        ['a short code into a full field', '123456', '78', '78', 2],
    ])('a paste replaces the code in %s', async (_name, initial, pasted, expected, active) => {
        const fixture = mount(initial);
        await userEvent.click(slots(fixture)[0]);
        fixture.componentInstance.emissions.length = 0;

        paste(fixture, pasted);

        expect(hidden(fixture).value).toBe(expected);
        expect(fixture.componentInstance.code()).toBe(expected);
        expect(fixture.componentInstance.emissions).toEqual([expected]);
        expect(activeSlot(fixture)).toBe(active);
    });
});
