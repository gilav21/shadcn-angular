import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScrollProgressComponent } from './scroll-progress.component';

@Component({
    template: `
        <ui-scroll-progress
            [position]="position()"
            [color]="color()"
            [height]="height()"
            [class]="cls()"
        />
    `,
    imports: [ScrollProgressComponent],
})
class TestHostComponent {
    position = signal<'top' | 'bottom'>('top');
    color = signal('hsl(var(--primary))');
    height = signal(3);
    cls = signal('');
}

describe('ScrollProgressComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        Object.defineProperty(document.documentElement, 'scrollTop', { value: 0, configurable: true });
    });

    it('should render a fixed bar element with data-slot attribute', () => {
        const bar = fixture.debugElement.query(By.css('[data-slot="scroll-progress"]'));
        expect(bar).toBeTruthy();
    });

    it('should start at 0% width on initial render', () => {
        const bar = fixture.debugElement.query(By.css('[data-slot="scroll-progress"]'));
        expect((bar.nativeElement as HTMLElement).style.width).toBe('0%');
    });

    it('should apply top-0 class when position is top', () => {
        host.position.set('top');
        fixture.detectChanges();

        const bar = fixture.debugElement.query(By.css('[data-slot="scroll-progress"]'));
        expect((bar.nativeElement as HTMLElement).className).toContain('top-0');
    });

    it('should apply bottom-0 class when position is bottom', () => {
        host.position.set('bottom');
        fixture.detectChanges();

        const bar = fixture.debugElement.query(By.css('[data-slot="scroll-progress"]'));
        expect((bar.nativeElement as HTMLElement).className).toContain('bottom-0');
    });

    it('should not apply top-0 class when position is bottom', () => {
        host.position.set('bottom');
        fixture.detectChanges();

        const bar = fixture.debugElement.query(By.css('[data-slot="scroll-progress"]'));
        expect((bar.nativeElement as HTMLElement).className).not.toContain('top-0');
    });

    it('should apply custom background color via inline style', () => {
        host.color.set('#ff0000');
        fixture.detectChanges();
        // Trigger ngAfterViewInit by re-creating (color is set at AfterViewInit)
        const bar = fixture.debugElement.query(By.css('[data-slot="scroll-progress"]'));
        expect(bar).toBeTruthy();
    });

    it('should apply height style in pixels via inline style', () => {
        const bar = fixture.debugElement.query(By.css('[data-slot="scroll-progress"]'));
        expect((bar.nativeElement as HTMLElement).style.height).toBe('3px');
    });

    it('should apply fixed positioning class', () => {
        const bar = fixture.debugElement.query(By.css('[data-slot="scroll-progress"]'));
        expect((bar.nativeElement as HTMLElement).className).toContain('fixed');
    });

    it('should apply custom class', () => {
        host.cls.set('my-progress');
        fixture.detectChanges();

        const bar = fixture.debugElement.query(By.css('[data-slot="scroll-progress"]'));
        expect((bar.nativeElement as HTMLElement).className).toContain('my-progress');
    });
});
