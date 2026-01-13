import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { KbdComponent } from './kbd.component';

@Component({
    template: `
    <ui-kbd [class]="'custom-class'">Ctrl</ui-kbd>
    <ui-kbd>K</ui-kbd>
  `,
    imports: [KbdComponent]
})
class TestHostComponent { }

describe('KbdComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent, KbdComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('should create and render kbd elements', () => {
        const kbds = fixture.debugElement.queryAll(By.directive(KbdComponent));
        expect(kbds.length).toBe(2);
    });

    it('should use <kbd> tag', () => {
        const kbd = fixture.debugElement.query(By.css('kbd'));
        expect(kbd).toBeTruthy();
        expect(kbd.nativeElement.textContent).toContain('Ctrl');
    });

    it('should apply base classes', () => {
        const kbd = fixture.debugElement.query(By.css('kbd'));
        expect(kbd.nativeElement.classList.contains('inline-flex')).toBe(true);
        expect(kbd.nativeElement.classList.contains('bg-muted')).toBe(true);
        expect(kbd.nativeElement.classList.contains('font-mono')).toBe(true);
    });

    it('should apply custom classes', () => {
        // We look for the internal kbd element that should have the class
        const kbd = fixture.debugElement.query(By.css('kbd.custom-class'));
        expect(kbd).toBeTruthy();
    });
});
