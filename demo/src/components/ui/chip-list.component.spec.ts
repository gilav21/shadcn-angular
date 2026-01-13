import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChipListComponent } from './chip-list.component';
import { BadgeComponent } from './badge.component';
import { ButtonComponent } from './button.component';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';

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
            imports: [TestHostComponent, ChipListComponent, BadgeComponent, ButtonComponent]
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
        expect(chips.length).toBe(2);
        expect(chips[0].nativeElement.textContent).toContain('React');
        expect(chips[1].nativeElement.textContent).toContain('Angular');
    });

    it('should add chip on Enter', () => {
        const inputDebug = fixture.debugElement.query(By.css('input'));
        const input = inputDebug.nativeElement as HTMLInputElement;

        input.value = 'Vue';
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();

        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        fixture.detectChanges();

        expect(host.chips.length).toBe(3);
        expect(host.chips).toContain('Vue');
        expect(input.value).toBe(''); // Should clear input
    });

    it('should remove chip on delete button click', () => {
        const chips = fixture.debugElement.queryAll(By.directive(BadgeComponent));
        const removeBtn = chips[0].query(By.css('ui-button'));

        removeBtn.nativeElement.click();
        fixture.detectChanges();

        expect(host.chips.length).toBe(1);
        expect(host.chips).not.toContain('React');
        expect(host.chips).toContain('Angular');
    });

    it('should remove last chip on Backspace if input empty', () => {
        const inputDebug = fixture.debugElement.query(By.css('input'));
        const input = inputDebug.nativeElement;

        expect(input.value).toBe('');

        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
        fixture.detectChanges();

        expect(host.chips.length).toBe(1);
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
