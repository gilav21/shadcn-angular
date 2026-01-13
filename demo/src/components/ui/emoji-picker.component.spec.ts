import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmojiPickerComponent } from './emoji-picker.component';
import { EmojiPickerTriggerComponent, EmojiPickerContentComponent } from './emoji-picker.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock component to test content interactions
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

describe
    ('EmojiPickerComponent', () => {
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
    });
