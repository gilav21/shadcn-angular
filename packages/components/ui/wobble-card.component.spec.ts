import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { WobbleCardComponent } from './wobble-card.component';

@Component({
    template: `
        <ui-wobble-card [intensity]="intensity()" [perspective]="perspective()" [class]="cls()">
            <p>Card Content</p>
        </ui-wobble-card>
    `,
    imports: [WobbleCardComponent],
})
class TestHostComponent {
    intensity = signal(15);
    perspective = signal(1000);
    cls = signal('');
}

describe('WobbleCardComponent', () => {
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

    it('should render projected content', () => {
        const el = fixture.debugElement.query(By.directive(WobbleCardComponent));
        expect(el.nativeElement.textContent.trim()).toBe('Card Content');
    });

    it('should have initial transform with zero rotation', () => {
        const el = fixture.debugElement.query(By.directive(WobbleCardComponent));
        const style = (el.nativeElement as HTMLElement).style.transform;
        expect(style).toContain('rotateX(0deg)');
        expect(style).toContain('rotateY(0deg)');
    });

    it('should include perspective in the initial transform', () => {
        host.perspective.set(800);
        fixture.detectChanges();

        const comp = fixture.debugElement.query(By.directive(WobbleCardComponent)).componentInstance as WobbleCardComponent;
        const styles = comp.styles() as { transform: string };
        expect(styles.transform).toContain('perspective(800px)');
    });

    it('should apply rotation on mousemove', () => {
        const el = fixture.debugElement.query(By.directive(WobbleCardComponent));
        const nativeEl = el.nativeElement as HTMLElement;

        Object.defineProperty(nativeEl, 'getBoundingClientRect', {
            value: () => ({ left: 0, top: 0, width: 200, height: 100 }),
            configurable: true,
        });

        nativeEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 30, bubbles: true }));
        fixture.detectChanges();

        const comp = el.componentInstance as WobbleCardComponent;
        const styles = comp.styles() as { transform: string };
        expect(styles.transform).not.toContain('rotateX(0deg)');
    });

    it('should reset rotation on mouseleave', () => {
        const el = fixture.debugElement.query(By.directive(WobbleCardComponent));
        const nativeEl = el.nativeElement as HTMLElement;

        Object.defineProperty(nativeEl, 'getBoundingClientRect', {
            value: () => ({ left: 0, top: 0, width: 200, height: 100 }),
            configurable: true,
        });

        nativeEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 30, bubbles: true }));
        fixture.detectChanges();

        nativeEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        fixture.detectChanges();

        const comp = el.componentInstance as WobbleCardComponent;
        const styles = comp.styles() as { transform: string };
        expect(styles.transform).toContain('rotateX(0deg)');
        expect(styles.transform).toContain('rotateY(0deg)');
    });

    it('should apply data-slot attribute', () => {
        const el = fixture.debugElement.query(By.directive(WobbleCardComponent));
        expect((el.nativeElement as HTMLElement).dataset['slot']).toBe('wobble-card');
    });

    it('should apply custom class', () => {
        host.cls.set('my-card');
        fixture.detectChanges();

        const el = fixture.debugElement.query(By.directive(WobbleCardComponent));
        expect((el.nativeElement as HTMLElement).className).toContain('my-card');
    });

    it('should apply base classes including rounded-xl', () => {
        const el = fixture.debugElement.query(By.directive(WobbleCardComponent));
        expect((el.nativeElement as HTMLElement).className).toContain('rounded-xl');
    });
});
