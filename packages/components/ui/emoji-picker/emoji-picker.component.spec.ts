import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmojiPickerComponent } from './emoji-picker.component';
import { EmojiPickerTriggerComponent } from './sub/emoji-picker-trigger.component';
import { EmojiPickerContentComponent } from './sub/emoji-picker-content.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

@Component({
    template: `
    <ui-emoji-picker [closeOnSelect]="closeOnSelect()" (emojiSelect)="onSelect($event)">
        <ui-emoji-picker-trigger>
        Open
        </ui-emoji-picker-trigger>
      <ui-emoji-picker-content />
    </ui-emoji-picker>
  `,
    imports: [EmojiPickerComponent, EmojiPickerTriggerComponent, EmojiPickerContentComponent]
})
class TestHostComponent {
    closeOnSelect = signal(true);
    selectedEmoji: string | null = null;
    onSelect(emoji: string) {
        this.selectedEmoji = emoji;
    }
}

describe('EmojiPickerComponent', () => {
        let component: TestHostComponent;
        let fixture: ComponentFixture<TestHostComponent>;
        let pickerInstance: EmojiPickerComponent;

        beforeEach(async () => {
            await TestBed.configureTestingModule({
                imports: [TestHostComponent]
            }).compileComponents();


            fixture = TestBed.createComponent(TestHostComponent);
            component = fixture.componentInstance;
            // Access the child EmojiPickerComponent instance
            pickerInstance = fixture.debugElement.query(By.directive(EmojiPickerComponent)).componentInstance;
            fixture.detectChanges();
        });

        it('should create', () => {
            expect(component).toBeTruthy();
        });

        it('should open on trigger click', () => {
            const trigger = fixture.debugElement.query(By.directive(EmojiPickerTriggerComponent));
            const triggerSpan = trigger.query(By.css('[data-slot="emoji-picker-trigger"]'));
            triggerSpan.nativeElement.click();
            fixture.detectChanges();

            expect(pickerInstance.open()).toBe(true);
            // data-state should allow popper to show
            expect(document.querySelector('[data-state="open"]')).toBeTruthy();
            // Note: Content uses @if(open()) so strictly checks signal interactions first
        });

        it('should close on select when closeOnSelect is true (default)', () => {
            // Open picker
            pickerInstance.open.set(true);
            fixture.detectChanges();

            // Simulate selection logic (mocking the internal selection flow as integration test is complex)
            // Calling selectEmoji directly to verify logic
            pickerInstance.selectEmoji('🐶');
            fixture.detectChanges();

            expect(component.selectedEmoji).toBe('🐶');
            expect(pickerInstance.open()).toBe(false);
        });

        it('should NOT close on select when closeOnSelect is false', () => {
            component.closeOnSelect.set(false);
            fixture.detectChanges();

            pickerInstance.open.set(true);
            fixture.detectChanges();

            pickerInstance.selectEmoji('🐱');
            fixture.detectChanges();

            expect(component.selectedEmoji).toBe('🐱');
            expect(pickerInstance.open()).toBe(true);
        });

        it('should emit selected emoji', () => {
            vi.spyOn(component, 'onSelect');
            pickerInstance.selectEmoji('🚀');
            expect(component.onSelect).toHaveBeenCalledWith('🚀');
        });

        it('renders search as an input-group with an icon addon, not an absolute overlay over the field', () => {
            pickerInstance.open.set(true);
            fixture.detectChanges();

            const content = document.querySelector('[data-slot="emoji-picker-content"]')!;
            const group = content.querySelector('[data-slot="input-group"]');
            expect(group).toBeTruthy();
            // The search icon is a flex-sibling addon, not an absolutely-positioned
            // SVG sitting on top of a padded input (which overlapped the text because
            // ui-input's scoped padding CSS beat the ps-8 utility).
            const addon = group!.querySelector('[data-slot="input-group-addon"]');
            expect(addon?.querySelector('svg')).toBeTruthy();
            expect(content.querySelector('svg.absolute')).toBeNull();
            expect(group!.querySelector('input')).toBeTruthy();
        });

        it('defers off-screen emoji painting via content-visibility (avoids the 1500-glyph paint stall)', () => {
            pickerInstance.open.set(true);
            fixture.detectChanges();

            const sections = document.querySelectorAll(
                '[data-slot="emoji-picker-content"] [data-category]'
            );
            expect(sections.length).toBeGreaterThan(1);
            for (const section of Array.from(sections)) {
                expect(getComputedStyle(section as HTMLElement).contentVisibility).toBe('auto');
            }
        });
    });
