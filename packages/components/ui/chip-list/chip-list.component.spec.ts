import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChipListComponent } from './chip-list.component';
import { BadgeComponent } from '../badge';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';

@Component({
    template: `
    <div [dir]="dir()">
      <ui-chip-list [(ngModel)]="chips" [placeholder]="placeholder"></ui-chip-list>
    </div>
  `,
    imports: [ChipListComponent, FormsModule]
})
class TestHostComponent {
    chips: string[] = ['React', 'Angular'];
    placeholder = 'Add tech...';
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('ChipListComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent, ChipListComponent, BadgeComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();

        // Manually write value to ensure initialization if ngModel is async
        const chipList = fixture.debugElement.query(By.directive(ChipListComponent)).componentInstance;
        chipList.writeValue(host.chips);
        fixture.detectChanges();
    });

    it('should create', () => {
        const chipList = fixture.debugElement.query(By.directive(ChipListComponent));
        expect(chipList).toBeTruthy();
    });

    it('should render initial chips', () => {
        fixture.detectChanges();
        const chips = fixture.debugElement.queryAll(By.directive(BadgeComponent));
        expect(chips).toHaveLength(2);
        expect(chips[0].nativeElement.textContent).toContain('React');
        expect(chips[1].nativeElement.textContent).toContain('Angular');
    });

    it('should add chip on Enter', async () => {
        const chipListDebug = fixture.debugElement.query(By.directive(ChipListComponent));
        const chipList = chipListDebug.componentInstance as ChipListComponent;
        const inputDebug = fixture.debugElement.query(By.css('input'));
        const input = inputDebug.nativeElement as HTMLInputElement;

        input.value = 'Vue';
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();

        input.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            bubbles: true,
            cancelable: true,
            composed: true
        }));
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        // Check component's internal state
        expect(chipList.chips()).toHaveLength(3);
        expect(chipList.chips()).toContain('Vue');
        expect(chipList.inputValue()).toBe(''); // Should clear input
    });

    it('should remove chip on delete button click', () => {
        const chips = fixture.debugElement.queryAll(By.directive(BadgeComponent));
        const removeBtn = chips[0].query(By.css('button[data-slot="chip-remove"]'));

        removeBtn.nativeElement.click();
        fixture.detectChanges();

        expect(host.chips).toHaveLength(1);
        expect(host.chips).not.toContain('React');
        expect(host.chips).toContain('Angular');
    });

    it('renders a compact remove button (not the 36px ui-button) so chips stay chip-sized', () => {
        const chips = fixture.debugElement.queryAll(By.directive(BadgeComponent));
        const removeBtn = chips[0].query(By.css('button[data-slot="chip-remove"]'));
        // The remove control must be a plain <button>, not a ui-button whose
        // density CSS forces a 36px box and inflates the whole chip.
        expect(removeBtn).toBeTruthy();
        expect(removeBtn.query(By.css('ui-button'))).toBeNull();
        expect(removeBtn.nativeElement.tagName.toLowerCase()).toBe('button');
        const rect = removeBtn.nativeElement.getBoundingClientRect();
        expect(rect.height).toBeLessThanOrEqual(24);
        expect(rect.width).toBeLessThanOrEqual(24);
    });

    it('should remove last chip on Backspace if input empty', async () => {
        const inputDebug = fixture.debugElement.query(By.css('input'));
        const input = inputDebug.nativeElement;

        expect(input.value).toBe('');

        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
        fixture.detectChanges();
        await fixture.whenStable();

        expect(host.chips).toHaveLength(1);
        // Should remove 'Angular' (last one)
        expect(host.chips).toEqual(['React']);
    });

    it('should apply correct padding in RTL mode', async () => {
        // Switch to RTL
        host.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const chips = fixture.debugElement.queryAll(By.directive(BadgeComponent));
        // Check first chip
        const chipClass = chips[0].nativeElement.className;

        // In the component: 'ltr:pr-1 rtl:pl-1'
        // We verify that these classes are present. 
        // Note: Tailwind classes are static strings in class attribute usually, so we just check existence.
        expect(chipClass).toContain('ltr:pr-1');
        expect(chipClass).toContain('rtl:pl-1');

        // Check that the container inherits/respects direction effectively implies styles would apply
        // Specifically, we can check if the input direction is affected if relevant, but the badge classes are the main RTL feature here.
    });
});

describe('ChipListComponent (standalone unit)', () => {
    let fixture: ComponentFixture<ChipListComponent>;
    let component: ChipListComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ChipListComponent, FormsModule]
        }).compileComponents();

        fixture = TestBed.createComponent(ChipListComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('maxHeightStyle returns none when maxRows is 0', () => {
        fixture.componentRef.setInput('maxRows', 0);
        fixture.detectChanges();
        expect(component.maxHeightStyle()).toBe('none');
    });

    it('maxHeightStyle computes pixel height and adds overflow class when maxRows > 0', () => {
        fixture.componentRef.setInput('maxRows', 3);
        fixture.detectChanges();
        // 3 * 36 + 8 = 116
        expect(component.maxHeightStyle()).toBe('116px');
        expect(component.containerClasses()).toContain('overflow-y-auto');
    });

    it('containerClasses reflects the disabled state', () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        expect(component.containerClasses()).toContain('opacity-50');
        expect(component.containerClasses()).toContain('cursor-not-allowed');
    });

    it('focusInput does nothing when disabled', () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        const focusSpy = vi.spyOn(component.inputComponent(), 'focus');
        component.focusInput();
        expect(focusSpy).not.toHaveBeenCalled();
    });

    it('focusInput focuses the input when enabled', () => {
        const focusSpy = vi.spyOn(component.inputComponent(), 'focus').mockImplementation(() => { });
        component.focusInput();
        expect(focusSpy).toHaveBeenCalledTimes(1);
    });

    it('addChip ignores blank/whitespace-only values', () => {
        const added: string[] = [];
        component.chipAdded.subscribe(v => added.push(v));
        component.addChip('   ');
        expect(component.chips()).toHaveLength(0);
        expect(added).toHaveLength(0);
    });

    it('addChip drops duplicates (allowDuplicates=false) and clears the input', () => {
        const added: string[] = [];
        component.chipAdded.subscribe(v => added.push(v));
        component.addChip('React');
        expect(component.chips()).toEqual(['React']);
        expect(added).toEqual(['React']);

        component.inputValue.set('React');
        component.addChip('React');
        // Still one chip; input cleared; no second emit
        expect(component.chips()).toEqual(['React']);
        expect(component.inputValue()).toBe('');
        expect(added).toEqual(['React']);
    });

    it('addChip keeps duplicates when allowDuplicates=true', () => {
        fixture.componentRef.setInput('allowDuplicates', true);
        fixture.detectChanges();
        component.addChip('React');
        component.addChip('React');
        expect(component.chips()).toEqual(['React', 'React']);
    });

    it('onKeyDown adds a chip when a separator key is pressed', () => {
        fixture.componentRef.setInput('separatorKeys', [',']);
        fixture.detectChanges();
        component.inputValue.set('Svelte');
        const event = new KeyboardEvent('keydown', { key: ',', cancelable: true });
        const preventSpy = vi.spyOn(event, 'preventDefault');
        component.onKeyDown(event);
        expect(preventSpy).toHaveBeenCalled();
        expect(component.chips()).toEqual(['Svelte']);
    });

    it('onKeyDown on Enter with empty value does not add a chip', () => {
        component.inputValue.set('   ');
        const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
        component.onKeyDown(event);
        expect(component.chips()).toHaveLength(0);
    });

    it('onKeyDown Backspace removes the last chip only when input is empty', () => {
        const removed: string[] = [];
        component.chipRemoved.subscribe(v => removed.push(v));
        component.writeValue(['a', 'b']);
        component.inputValue.set('');
        component.onKeyDown(new KeyboardEvent('keydown', { key: 'Backspace' }));
        expect(component.chips()).toEqual(['a']);
        expect(removed).toEqual(['b']);
    });

    it('onKeyDown Backspace is a no-op when the input still has text', () => {
        component.writeValue(['a', 'b']);
        component.inputValue.set('typing');
        component.onKeyDown(new KeyboardEvent('keydown', { key: 'Backspace' }));
        expect(component.chips()).toEqual(['a', 'b']);
    });

    it('onInputChange updates the inputValue signal', () => {
        component.onInputChange('hello');
        expect(component.inputValue()).toBe('hello');
    });

    it('chipForeground returns a readable colour for painted chips and null otherwise', () => {
        fixture.componentRef.setInput('chipColors', { React: '#ffffff' });
        fixture.detectChanges();
        expect(component.chipForeground('React')).toBeTruthy();
        expect(component.chipForeground('Angular')).toBeNull();
    });

    it('removeChip removes the chip, emits, stops propagation, and re-focuses after the timeout', () => {
        vi.useFakeTimers();
        const focusSpy = vi.spyOn(component.inputComponent(), 'focus').mockImplementation(() => { });
        const removed: string[] = [];
        component.chipRemoved.subscribe(v => removed.push(v));
        component.writeValue(['a', 'b', 'c']);
        const event = new Event('click');
        const stopSpy = vi.spyOn(event, 'stopPropagation');
        component.removeChip(1, event);
        expect(stopSpy).toHaveBeenCalled();
        expect(component.chips()).toEqual(['a', 'c']);
        expect(removed).toEqual(['b']);
        // The deferred focus (setTimeout) restores focus to the input after removal.
        focusSpy.mockClear();
        vi.runAllTimers();
        expect(focusSpy).toHaveBeenCalled();
        vi.useRealTimers();
    });

    it('onBlur marks the control as touched', () => {
        let touched = false;
        component.registerOnTouched(() => { touched = true; });
        component.onBlur();
        expect(touched).toBe(true);
    });

    it('writeValue tolerates a null value', () => {
        component.writeValue(null as unknown as string[]);
        expect(component.chips()).toEqual([]);
    });

    it('setDisabledState is a no-op that does not throw', () => {
        expect(() => component.setDisabledState(true)).not.toThrow();
    });

    it('default onChange/onTouched are safe before registration', () => {
        // No registerOnChange/registerOnTouched here: exercises the default arrows.
        expect(() => {
            component.addChip('solo');
            component.onBlur();
        }).not.toThrow();
        expect(component.chips()).toEqual(['solo']);
    });
});
