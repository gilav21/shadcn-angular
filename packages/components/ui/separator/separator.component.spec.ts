import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SeparatorComponent } from './separator.component';
import { describe, it, expect, beforeEach } from 'vitest';

describe('SeparatorComponent', () => {
    let fixture: ComponentFixture<SeparatorComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SeparatorComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SeparatorComponent);
        fixture.detectChanges();
    });

    it('should have data-slot="separator"', () => {
        expect(fixture.nativeElement.dataset['slot']).toBe('separator');
    });

    it('should have role="separator"', () => {
        expect(fixture.nativeElement.getAttribute('role')).toBe('separator');
    });

    it('mirrors the orientation to aria-orientation', () => {
        expect(fixture.nativeElement.getAttribute('aria-orientation')).toBe('horizontal');

        fixture.componentRef.setInput('orientation', 'vertical');
        fixture.detectChanges();

        expect(fixture.nativeElement.getAttribute('aria-orientation')).toBe('vertical');
    });

    it('should apply custom class', () => {
        fixture.componentRef.setInput('class', 'my-separator');
        fixture.detectChanges();

        expect(fixture.nativeElement.className).toContain('my-separator');
    });
});
