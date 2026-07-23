import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SparklesComponent } from './sparkles.component';
import { SparklesButtonComponent } from './sub/sparkles-button.component';

describe('Sparkles Components', () => {
  describe('SparklesComponent', () => {
    let component: SparklesComponent;
    let fixture: ComponentFixture<SparklesComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [SparklesComponent],
      }).compileComponents();

      fixture = TestBed.createComponent(SparklesComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should render the sparkle svg with base classes', () => {
      const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
      expect(svg).toBeTruthy();
      expect(component.classes()).toContain('pointer-events-none');
      expect(component.classes()).toContain('absolute');
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    });

    it('should merge a custom class input into the computed classes', () => {
      fixture.componentRef.setInput('class', 'text-red-500 w-8');
      fixture.detectChanges();

      const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
      expect(component.classes()).toContain('text-red-500');
      expect(component.classes()).toContain('w-8');
      expect(svg.getAttribute('class')).toContain('text-red-500');
    });
  });

  describe('SparklesButtonComponent', () => {
    let component: SparklesButtonComponent;
    let fixture: ComponentFixture<SparklesButtonComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [SparklesButtonComponent],
      }).compileComponents();

      fixture = TestBed.createComponent(SparklesButtonComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should not render sparkles until hovering', () => {
      const element = fixture.nativeElement as HTMLElement;
      expect(component.hovering()).toBe(false);
      expect(element.querySelector('ui-sparkles')).toBeNull();
    });

    it('should spawn three sparkles when hovering starts', () => {
      component.startSparkles();
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(component.hovering()).toBe(true);
      expect(element.querySelectorAll('ui-sparkles')).toHaveLength(3);
    });

    it('should remove sparkles when hovering stops', () => {
      component.startSparkles();
      fixture.detectChanges();
      component.stopSparkles();
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(component.hovering()).toBe(false);
      expect(element.querySelector('ui-sparkles')).toBeNull();
    });

    it('should reflect variant and size inputs onto the inner button', () => {
      fixture.componentRef.setInput('variant', 'destructive');
      fixture.componentRef.setInput('size', 'lg');
      fixture.detectChanges();

      expect(component.variant()).toBe('destructive');
      expect(component.size()).toBe('lg');
      expect(fixture.nativeElement.querySelector('ui-button')).toBeTruthy();
    });

    it('should merge a custom class into the computed button classes', () => {
      fixture.componentRef.setInput('class', 'my-custom-btn');
      fixture.detectChanges();

      expect(component.classes()).toContain('group');
      expect(component.classes()).toContain('my-custom-btn');
    });
  });
});
