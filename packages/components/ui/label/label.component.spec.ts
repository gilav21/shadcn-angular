import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LabelComponent } from './label.component';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';

describe('LabelComponent', () => {
    let fixture: ComponentFixture<LabelComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [LabelComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(LabelComponent);
        fixture.detectChanges();
    });

    it('should have data-slot="label"', () => {
        const label = fixture.debugElement.query(By.css('label'));
        expect(label.nativeElement.dataset.slot).toBe('label');
    });

    it('should set for attribute', () => {
        fixture.componentRef.setInput('for', 'my-input');
        fixture.detectChanges();

        const label = fixture.debugElement.query(By.css('label'));
        expect(label.nativeElement.getAttribute('for')).toBe('my-input');
    });

    it('should apply custom class', () => {
        fixture.componentRef.setInput('class', 'my-label');
        fixture.detectChanges();

        const label = fixture.debugElement.query(By.css('label'));
        expect(label.nativeElement.className).toContain('my-label');
    });
});
