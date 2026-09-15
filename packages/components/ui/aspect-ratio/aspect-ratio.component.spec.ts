import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AspectRatioComponent } from './aspect-ratio.component';
import { Component, ViewChild } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';

@Component({
    template: `
    <ui-aspect-ratio [ratio]="ratio">
        <img src="test.jpg" alt="test" />
    </ui-aspect-ratio>
  `,
    imports: [AspectRatioComponent]
})
class TestHostComponent {
    ratio = 16 / 9;
    @ViewChild(AspectRatioComponent) aspectRatioComponent!: AspectRatioComponent;
}

describe('AspectRatioComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let component: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent, AspectRatioComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        fixture.detectChanges();
        expect(component.aspectRatioComponent).toBeTruthy();
    });

    it('should calculate correct padding-bottom for 16/9', () => {
        fixture.detectChanges();
        const div = fixture.debugElement.query(By.css('[data-slot="aspect-ratio"]'));
        // 1 / (16/9) * 100 = 56.25
        expect(div.styles['paddingBottom']).toBe('56.25%');
    });

    it('should calculate correct padding-bottom for 4/3', () => {
        component.ratio = 4 / 3;
        fixture.detectChanges();
        const div = fixture.debugElement.query(By.css('[data-slot="aspect-ratio"]'));
        // 1 / (4/3) * 100 = 75
        expect(div.styles['paddingBottom']).toBe('75%');
    });

    it('should render content', () => {
        fixture.detectChanges();
        const img = fixture.debugElement.query(By.css('img'));
        expect(img).toBeTruthy();
    });
});
