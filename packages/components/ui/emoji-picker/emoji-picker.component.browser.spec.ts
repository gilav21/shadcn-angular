import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect } from 'vitest';
import { EmojiPickerComponent } from './emoji-picker.component';
import { EmojiPickerTriggerComponent } from './sub/emoji-picker-trigger.component';
import { EmojiPickerContentComponent } from './sub/emoji-picker-content.component';

/** Browser-only: the fixed strategy is asserted as rendered geometry and computed style. */
@Component({
    template: `
        <div style="padding: 40px">
            <ui-emoji-picker>
                <ui-emoji-picker-trigger>Open</ui-emoji-picker-trigger>
                <ui-emoji-picker-content strategy="fixed" />
            </ui-emoji-picker>
        </div>
    `,
    imports: [EmojiPickerComponent, EmojiPickerTriggerComponent, EmojiPickerContentComponent],
})
class FixedHost {}

const frame = (): Promise<void> => new Promise(resolve => requestAnimationFrame(() => resolve()));

describe('EmojiPickerContentComponent — fixed strategy (real layout)', () => {
    it('stays hidden until measured, then pins the panel 4px below the trigger', async () => {
        await TestBed.configureTestingModule({ imports: [FixedHost] }).compileComponents();
        const fixture = TestBed.createComponent(FixedHost);
        fixture.detectChanges();
        const picker: EmojiPickerComponent = fixture.debugElement
            .query(By.directive(EmojiPickerComponent)).componentInstance;

        picker.open.set(true);
        fixture.detectChanges();
        const panel: HTMLElement = fixture.nativeElement.querySelector('[data-slot="emoji-picker-content"]');
        expect(getComputedStyle(panel).visibility).toBe('hidden');

        await frame();
        fixture.detectChanges();
        await fixture.whenStable();
        panel.getAnimations().forEach(a => a.finish());

        const trigger = (fixture.nativeElement as HTMLElement)
            .querySelector('[data-slot="emoji-picker-trigger"]')!.getBoundingClientRect();
        const rect = panel.getBoundingClientRect();
        expect(getComputedStyle(panel).visibility).toBe('visible');
        expect(getComputedStyle(panel).position).toBe('fixed');
        expect(Math.abs(rect.top - (trigger.bottom + 4))).toBeLessThan(1);
        expect(Math.abs(rect.left - trigger.left)).toBeLessThan(1);
    });
});
