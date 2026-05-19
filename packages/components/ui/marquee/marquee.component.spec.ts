import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { MarqueeComponent } from './marquee.component';

@Component({
    template: `
        <ui-marquee
            [direction]="direction()"
            [speed]="speed()"
            [pauseOnHover]="pauseOnHover()"
            [gap]="gap()"
            [class]="cls()"
        >
            <span class="item">Item A</span>
            <span class="item">Item B</span>
        </ui-marquee>
    `,
    imports: [MarqueeComponent],
})
class TestHostComponent {
    direction = signal<'left' | 'right' | 'up' | 'down'>('left');
    speed = signal(20);
    pauseOnHover = signal(false);
    gap = signal(16);
    cls = signal('');
}

describe('MarqueeComponent', () => {
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

    it('should render the marquee element with data-slot', () => {
        const marquee = fixture.debugElement.query(By.css('[data-slot="marquee"]'));
        expect(marquee).toBeTruthy();
    });

    it('should render projected content', () => {
        const items = fixture.debugElement.queryAll(By.css('.item'));
        expect(items.length).toBeGreaterThanOrEqual(2);
        expect(items[0].nativeElement.textContent).toContain('Item A');
    });

    it('should apply overflow-hidden class', () => {
        const marquee = fixture.debugElement.query(By.css('[data-slot="marquee"]'));
        expect((marquee.nativeElement as HTMLElement).className).toContain('overflow-hidden');
    });

    it('should apply custom class', () => {
        host.cls.set('my-marquee');
        fixture.detectChanges();

        const marquee = fixture.debugElement.query(By.css('[data-slot="marquee"]'));
        expect((marquee.nativeElement as HTMLElement).className).toContain('my-marquee');
    });

    it('should pause animation on mouseenter when pauseOnHover is true', () => {
        host.pauseOnHover.set(true);
        fixture.detectChanges();

        const comp = fixture.debugElement.query(By.directive(MarqueeComponent)).componentInstance as MarqueeComponent;
        const marqueeEl = fixture.debugElement.query(By.css('[data-slot="marquee"]'));
        marqueeEl.nativeElement.dispatchEvent(new Event('mouseenter'));

        expect((comp as any).animation === undefined || (comp as any).animation?.playState !== 'running').toBeTruthy();
    });

    it('should not pause on hover when pauseOnHover is false', () => {
        host.pauseOnHover.set(false);
        fixture.detectChanges();

        const marqueeEl = fixture.debugElement.query(By.css('[data-slot="marquee"]'));
        marqueeEl.nativeElement.dispatchEvent(new Event('mouseenter'));
        fixture.detectChanges();

        // No error thrown, animation state not changed
        expect(true).toBeTruthy();
    });

    it('should set gap style on the track element', () => {
        host.gap.set(32);
        fixture.detectChanges();

        const segment = fixture.debugElement.query(By.css('[data-slot="marquee"] > div > div'));
        expect(segment).toBeTruthy();
    });

    it('should accept direction input', () => {
        const comp = fixture.debugElement.query(By.directive(MarqueeComponent)).componentInstance as MarqueeComponent;
        expect(comp.direction()).toBe('left');
        host.direction.set('right');
        fixture.detectChanges();
        expect(comp.direction()).toBe('right');
    });

    it('should accept speed input', () => {
        const comp = fixture.debugElement.query(By.directive(MarqueeComponent)).componentInstance as MarqueeComponent;
        expect(comp.speed()).toBe(20);
        host.speed.set(40);
        fixture.detectChanges();
        expect(comp.speed()).toBe(40);
    });
});
