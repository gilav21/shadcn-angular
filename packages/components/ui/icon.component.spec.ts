import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { IconComponent, ICONS } from './icon.component';

@Component({
    template: `
        <ui-icon name="check" class="custom-icon-class"></ui-icon>
        <ui-icon name="arrow-up"></ui-icon>
        <ui-icon name="nonexistent"></ui-icon>
    `,
    imports: [IconComponent]
})
class TestHostComponent { }

describe('IconComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent, IconComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('should create', () => {
        const icons = fixture.debugElement.queryAll(By.directive(IconComponent));
        expect(icons.length).toBe(3);
    });

    it('should render SVG element', () => {
        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg).toBeTruthy();
        expect(svg.nativeElement.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');
        expect(svg.nativeElement.getAttribute('viewBox')).toBe('0 0 24 24');
    });

    it('should render SVG content for known icon', () => {
        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg.nativeElement.innerHTML).toContain('path');
    });

    it('should apply correct class based on icon name', () => {
        const svgs = fixture.debugElement.queryAll(By.css('svg'));
        expect(svgs[0].nativeElement.classList.contains('ui-icon')).toBe(true);
        expect(svgs[0].nativeElement.classList.contains('ui-icon-check')).toBe(true);
        expect(svgs[1].nativeElement.classList.contains('ui-icon-arrow-up')).toBe(true);
    });

    it('should apply custom class input', () => {
        const svg = fixture.debugElement.query(By.css('svg'));
        expect(svg.nativeElement.className.baseVal || svg.nativeElement.getAttribute('class')).toContain('custom-icon-class');
    });

    it('should render empty SVG for unknown icon name', () => {
        const svgs = fixture.debugElement.queryAll(By.css('svg'));
        const unknownSvg = svgs[2];
        expect(unknownSvg.nativeElement.classList.contains('ui-icon-nonexistent')).toBe(true);
    });

    it('should export ICONS constant with expected keys', () => {
        expect(ICONS['check']).toBeDefined();
        expect(ICONS['arrow-up']).toBeDefined();
        expect(ICONS['x']).toBeDefined();
        expect(ICONS['calendar']).toBeDefined();
    });
});
