import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { SwitchComponent } from './switch.component';

/** Browser-only: thumb travel and label placement asserted as rendered geometry. */
@Component({
    template: `
        <div [attr.dir]="dir()" style="padding: 20px">
            <ui-switch [(checked)]="checked" [label]="label()" />
        </div>
    `,
    imports: [SwitchComponent],
})
class SwitchLayoutHost {
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
    readonly checked = signal(false);
    readonly label = signal<string | undefined>(undefined);
}

async function render(dir: 'ltr' | 'rtl', label?: string) {
    await TestBed.configureTestingModule({ imports: [SwitchLayoutHost] }).compileComponents();
    const fixture = TestBed.createComponent(SwitchLayoutHost);
    fixture.componentInstance.dir.set(dir);
    fixture.componentInstance.label.set(label);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
}

describe('Switch layout (real browser)', () => {
    it.each(['ltr', 'rtl'] as const)('moves the thumb from the inline-start to the inline-end of the track when checked (%s)', async dir => {
        const fixture = await render(dir);
        const track: HTMLElement = fixture.nativeElement.querySelector('[data-slot="switch"]');
        const thumb = track.querySelector('span') as HTMLElement;
        const settle = async (): Promise<void> => {
            fixture.detectChanges();
            await fixture.whenStable();
            thumb.getAnimations().forEach(a => a.finish());
        };
        const startGap = (): number => dir === 'ltr'
            ? thumb.getBoundingClientRect().left - track.getBoundingClientRect().left
            : track.getBoundingClientRect().right - thumb.getBoundingClientRect().right;
        const endGap = (): number => dir === 'ltr'
            ? track.getBoundingClientRect().right - thumb.getBoundingClientRect().right
            : thumb.getBoundingClientRect().left - track.getBoundingClientRect().left;

        await settle();
        expect(startGap()).toBeLessThanOrEqual(3);
        expect(endGap()).toBeGreaterThan(10);

        fixture.componentInstance.checked.set(true);
        await settle();
        expect(endGap()).toBeLessThanOrEqual(3);
        expect(endGap()).toBeGreaterThanOrEqual(0);
        expect(startGap()).toBeGreaterThan(10);
    });

    it.each(['ltr', 'rtl'] as const)('places the label after the switch on the inline axis, vertically centred with it (%s)', async dir => {
        const fixture = await render(dir, 'Enable notifications');
        const track = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="switch"]')!.getBoundingClientRect();
        // The label's text, not its box: a stretched label box stays centred even when its text does not.
        const range = document.createRange();
        range.selectNodeContents((fixture.nativeElement as HTMLElement).querySelector('label')!);
        const label = range.getBoundingClientRect();

        if (dir === 'ltr') {
            expect(label.left).toBeGreaterThanOrEqual(track.right);
        } else {
            expect(label.right).toBeLessThanOrEqual(track.left);
        }
        expect(Math.abs((label.top + label.height / 2) - (track.top + track.height / 2))).toBeLessThan(1.5);
    });
});
