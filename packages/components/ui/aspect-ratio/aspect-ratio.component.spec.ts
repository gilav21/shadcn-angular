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

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent, AspectRatioComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
    });

    it('should calculate correct padding-bottom for 16/9', () => {
        fixture.detectChanges();
        const div = fixture.debugElement.query(By.css('[data-slot="aspect-ratio"]'));
        // 1 / (16/9) * 100 = 56.25
        expect(div.styles['paddingBottom']).toBe('56.25%');
    });

    it('should render content', () => {
        fixture.detectChanges();
        const img = fixture.debugElement.query(By.css('img'));
        expect(img).toBeTruthy();
    });
});
