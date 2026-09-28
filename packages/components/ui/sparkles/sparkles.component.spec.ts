import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SparklesComponent } from './sparkles.component';
import { SparklesButtonComponent } from './sub/sparkles-button.component';
import { ButtonComponent } from '../button';

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

    it('should render the sparkle svg hidden from assistive technology', () => {
      const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
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

    function hover(type: 'mouseenter' | 'mouseleave'): void {
      (fixture.nativeElement as HTMLElement).querySelector('ui-button')!.dispatchEvent(new MouseEvent(type));
      fixture.detectChanges();
    }

    it('should spawn three sparkles when the pointer enters the button', () => {
      hover('mouseenter');

      expect((fixture.nativeElement as HTMLElement).querySelectorAll('ui-sparkles')).toHaveLength(3);
    });

    it('should remove sparkles when the pointer leaves the button', () => {
      hover('mouseenter');
      hover('mouseleave');

      expect((fixture.nativeElement as HTMLElement).querySelector('ui-sparkles')).toBeNull();
    });

    it('should pass variant and size to the inner button', () => {
      fixture.componentRef.setInput('variant', 'destructive');
      fixture.componentRef.setInput('size', 'lg');
      fixture.detectChanges();

      const button = fixture.debugElement.query(By.directive(ButtonComponent)).componentInstance as ButtonComponent;
      expect(button.variant()).toBe('destructive');
      expect(button.size()).toBe('lg');
    });

    it('should merge a custom class into the computed button classes', () => {
      fixture.componentRef.setInput('class', 'my-custom-btn');
      fixture.detectChanges();

      expect(component.classes()).toContain('group');
      expect(component.classes()).toContain('my-custom-btn');
    });
  });
});
