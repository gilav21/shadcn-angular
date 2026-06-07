import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ButtonComponent } from './button.component';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ButtonComponent', () => {
    let component: ButtonComponent;
    let fixture: ComponentFixture<ButtonComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ButtonComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(ButtonComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render a button element', () => {
        const button = fixture.debugElement.query(By.css('button'));
        expect(button).toBeTruthy();
        expect(button.attributes['data-slot']).toBe('button');
    });

    it('should have default type="button"', () => {
        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.type).toBe('button');
    });

    it('should apply default variant classes', () => {
        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.className).toContain('bg-primary');
        expect(button.nativeElement.className).toContain('text-primary-foreground');
    });

    it('should apply destructive variant classes', () => {
        fixture.componentRef.setInput('variant', 'destructive');
        fixture.detectChanges();

        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.className).toContain('bg-destructive');
        expect(button.nativeElement.className).toContain('text-destructive');
    });

    it('should apply outline variant classes', () => {
        fixture.componentRef.setInput('variant', 'outline');
        fixture.detectChanges();

        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.className).toContain('border-input');
        expect(button.nativeElement.className).toContain('bg-background');
    });

    it('should apply ghost variant classes', () => {
        fixture.componentRef.setInput('variant', 'ghost');
        fixture.detectChanges();

        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.className).toContain('hover:bg-muted');
    });

    it('should apply small size classes', () => {
        fixture.componentRef.setInput('size', 'sm');
        fixture.detectChanges();

        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.className).toContain('h-[calc(2rem*var(--_d))]');
        expect(button.nativeElement.className).toContain('text-xs');
    });

    it('should apply large size classes', () => {
        fixture.componentRef.setInput('size', 'lg');
        fixture.detectChanges();

        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.className).toContain('h-[calc(2.5rem*var(--_d))]');
        expect(button.nativeElement.className).toContain('px-[calc(2rem*var(--_d))]');
    });

    it('should apply icon size classes', () => {
        fixture.componentRef.setInput('size', 'icon');
        fixture.detectChanges();

        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.className).toContain('h-[calc(2.25rem*var(--_d))]');
        expect(button.nativeElement.className).toContain('w-[calc(2.25rem*var(--_d))]');
    });

    it('should be disabled when disabled input is true', () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();

        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.disabled).toBe(true);
    });

    it('should set type attribute correctly', () => {
        fixture.componentRef.setInput('type', 'submit');
        fixture.detectChanges();

        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.type).toBe('submit');
    });

    it('should apply custom class', () => {
        fixture.componentRef.setInput('class', 'my-custom-class');
        fixture.detectChanges();

        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.className).toContain('my-custom-class');
    });

    it('should set aria-label attribute', () => {
        fixture.componentRef.setInput('ariaLabel', 'Close dialog');
        fixture.detectChanges();

        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.getAttribute('aria-label')).toBe('Close dialog');
    });

    it('should emit clicked output when inner button is clicked', () => {
        const clickedSpy = vi.fn();
        component.clicked.subscribe(clickedSpy);

        const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
        button.click();

        expect(clickedSpy).toHaveBeenCalledTimes(1);
        expect(clickedSpy).toHaveBeenCalledWith(expect.any(MouseEvent));
    });
});
