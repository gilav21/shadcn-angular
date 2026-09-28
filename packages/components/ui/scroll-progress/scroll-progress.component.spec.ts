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
            [container]="container()"
        />
    `,
    imports: [ScrollProgressComponent],
})
class TestHostComponent {
    position = signal<'top' | 'bottom'>('top');
    color = signal('hsl(var(--primary))');
    height = signal(3);
    cls = signal('');
    container = signal<string | HTMLElement | null>(null);
}

@Component({
    template: `
        <div #wrap style="overflow-y:auto">
            <ui-scroll-progress />
        </div>
    `,
    imports: [ScrollProgressComponent],
})
class OverflowHostComponent {}

function queryBar(fixture: ComponentFixture<unknown>): HTMLElement {
    return fixture.debugElement.query(By.css('[data-slot="scroll-progress"]')).nativeElement as HTMLElement;
}

function stubScrollMetrics(el: HTMLElement, scrollTop: number, scrollHeight: number, clientHeight: number): void {
    Object.defineProperty(el, 'scrollTop', { configurable: true, writable: true, value: scrollTop });
    Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => scrollHeight });
    Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => clientHeight });
}

describe('ScrollProgressComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent, OverflowHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        Object.defineProperty(document.documentElement, 'scrollTop', { value: 0, configurable: true });
        delete (document.documentElement as unknown as Record<string, unknown>)['scrollHeight'];
        delete (document.documentElement as unknown as Record<string, unknown>)['clientHeight'];
        delete (document.body as unknown as Record<string, unknown>)['scrollTop'];
    });

    // color and height are read once in ngAfterViewInit, so they are set before the first render.
    it('should apply custom background color via inline style', () => {
        const f = TestBed.createComponent(TestHostComponent);
        f.componentInstance.color.set('#ff0000');
        f.detectChanges();
        expect(getComputedStyle(queryBar(f)).backgroundColor).toBe('rgb(255, 0, 0)');
        f.destroy();
    });

    it('should apply height style in pixels via inline style', () => {
        const f = TestBed.createComponent(TestHostComponent);
        f.componentInstance.height.set(6);
        f.detectChanges();
        expect(getComputedStyle(queryBar(f)).height).toBe('6px');
        f.destroy();
    });

    it('should apply custom class', () => {
        host.cls.set('my-progress');
        fixture.detectChanges();
        expect(queryBar(fixture).className).toContain('my-progress');
    });

    it('computes progress from an HTMLElement container across scroll positions', () => {
        const target = document.createElement('div');
        stubScrollMetrics(target, 0, 400, 100);

        const f = TestBed.createComponent(TestHostComponent);
        f.componentInstance.container.set(target);
        f.detectChanges();
        const bar = queryBar(f);

        // scrollHeight - clientHeight = 300; scrollTop 0 -> 0%
        expect(bar.style.width).toBe('0%');

        (target as unknown as { scrollTop: number }).scrollTop = 150;
        target.dispatchEvent(new Event('scroll'));
        expect(bar.style.width).toBe('50%');

        (target as unknown as { scrollTop: number }).scrollTop = 300;
        target.dispatchEvent(new Event('scroll'));
        expect(bar.style.width).toBe('100%');

        f.destroy();
    });

    it('clamps progress to 100% when scrollTop exceeds the scrollable range', () => {
        const target = document.createElement('div');
        stubScrollMetrics(target, 9999, 400, 100);

        const f = TestBed.createComponent(TestHostComponent);
        f.componentInstance.container.set(target);
        f.detectChanges();

        expect(queryBar(f).style.width).toBe('100%');
        f.destroy();
    });

    it('resolves a string selector container and computes progress', () => {
        const target = document.createElement('div');
        target.id = 'sp-string-target';
        stubScrollMetrics(target, 60, 300, 100);
        document.body.appendChild(target);

        const f = TestBed.createComponent(TestHostComponent);
        f.componentInstance.container.set('#sp-string-target');
        f.detectChanges();

        // range 200, scrollTop 60 -> 30%
        expect(queryBar(f).style.width).toBe('30%');

        f.destroy();
        target.remove();
    });

    it('falls back to window when a string selector matches nothing', () => {
        stubScrollMetrics(document.documentElement, 100, 500, 100);

        const f = TestBed.createComponent(TestHostComponent);
        f.componentInstance.container.set('#no-such-element-here');
        f.detectChanges();

        // window path: range 400, scrollTop 100 -> 25%
        expect(queryBar(f).style.width).toBe('25%');
        f.destroy();
    });

    it('swallows an invalid selector and falls back to window', () => {
        const f = TestBed.createComponent(TestHostComponent);
        f.componentInstance.container.set('!!!invalid((');
        expect(() => f.detectChanges()).not.toThrow();

        expect(queryBar(f).style.width).toBe('0%');
        f.destroy();
    });

    it('uses a scrollable ancestor element as the scroll target', () => {
        const f = TestBed.createComponent(OverflowHostComponent);
        f.detectChanges();

        const wrap = f.debugElement.query(By.css('div')).nativeElement as HTMLElement;
        stubScrollMetrics(wrap, 100, 500, 100);
        wrap.dispatchEvent(new Event('scroll'));

        // range 400, scrollTop 100 -> 25%
        expect(queryBar(f).style.width).toBe('25%');
        f.destroy();
    });

    it('computes window progress from document.body.scrollTop fallback', () => {
        Object.defineProperty(document.documentElement, 'scrollTop', { configurable: true, value: 0 });
        Object.defineProperty(document.body, 'scrollTop', { configurable: true, value: 40 });
        Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, get: () => 500 });
        Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, get: () => 100 });

        const f = TestBed.createComponent(TestHostComponent);
        f.detectChanges();

        // documentElement.scrollTop 0 (falsy) -> body.scrollTop 40; range 400 -> 10%
        expect(queryBar(f).style.width).toBe('10%');
        f.destroy();
    });

    it('reports 0% when the scrollable range is zero', () => {
        stubScrollMetrics(document.documentElement, 0, 100, 100);

        const f = TestBed.createComponent(TestHostComponent);
        f.detectChanges();

        // scrollHeight - clientHeight = 0 -> pct 0
        expect(queryBar(f).style.width).toBe('0%');
        f.destroy();
    });

    it('returns early without setting width when no scroll target resolves', () => {
        const ownDescriptor = Object.getOwnPropertyDescriptor(document, 'defaultView');
        Object.defineProperty(document, 'defaultView', { configurable: true, get: () => null });

        try {
            const f = TestBed.createComponent(TestHostComponent);
            f.detectChanges();
            const bar = queryBar(f);
            expect(bar.style.width).toBe('');
            expect(bar.style.height).toBe('3px');
            f.destroy();
        } finally {
            if (ownDescriptor) {
                Object.defineProperty(document, 'defaultView', ownDescriptor);
            } else {
                delete (document as unknown as Record<string, unknown>)['defaultView'];
            }
        }
    });

    it('removes the scroll listener on destroy', () => {
        const target = document.createElement('div');
        stubScrollMetrics(target, 0, 400, 100);

        const f = TestBed.createComponent(TestHostComponent);
        f.componentInstance.container.set(target);
        f.detectChanges();
        const bar = queryBar(f);
        f.destroy();

        (target as unknown as { scrollTop: number }).scrollTop = 200;
        target.dispatchEvent(new Event('scroll'));

        expect(bar.style.width).toBe('0%');
    });
});
