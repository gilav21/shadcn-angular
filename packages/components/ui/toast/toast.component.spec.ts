import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastService, ToastComponent } from './toast.component';
import { ToasterComponent } from './sub/toaster.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('ToastService', () => {
    let service: ToastService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(ToastService);
        service.dismissAll();
    });

    it('should add a toast', () => {
        service.toast({ title: 'Test' });
        expect(service.toasts()).toHaveLength(1);
        expect(service.toasts()[0].title).toBe('Test');
    });

    it('should dismiss a toast by id', () => {
        const id = service.toast({ title: 'Test' });
        service.dismiss(id);
        expect(service.toasts()).toHaveLength(0);
    });

    it('should auto-dismiss after duration', async () => {
        service.toast({ title: 'Auto', duration: 100 });
        expect(service.toasts()).toHaveLength(1);

        await new Promise(resolve => setTimeout(resolve, 150));
        expect(service.toasts()).toHaveLength(0);
    });

    it('should have helper methods for success and error', () => {
        service.success('Success');
        expect(service.toasts()[0].variant).toBe('success');

        service.error('Error');
        expect(service.toasts()[1].variant).toBe('destructive');
    });
});

describe('ToastService — countdown & cleanup (fake timers)', () => {
    let service: ToastService;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        TestBed.configureTestingModule({});
        service = TestBed.inject(ToastService);
        service.dismissAll();
    });

    afterEach(() => {
        service.dismissAll();
        vi.useRealTimers();
    });

    it('seeds countdownSeconds from duration when showCountdown is set', () => {
        service.toast({ title: 'CD', duration: 5000, showCountdown: true });
        expect(service.toasts()[0].countdownSeconds).toBe(5);
    });

    it('leaves countdownSeconds undefined when showCountdown is not set', () => {
        service.toast({ title: 'NoCD', duration: 5000 });
        expect(service.toasts()[0].countdownSeconds).toBeUndefined();
    });

    it('decrements countdownSeconds each second via the interval', () => {
        const id = service.toast({ title: 'Tick', duration: 5000, showCountdown: true });
        expect(service.toasts()[0].countdownSeconds).toBe(5);

        vi.advanceTimersByTime(1000);
        expect(service.toasts()[0].countdownSeconds).toBe(4);

        vi.advanceTimersByTime(2000);
        expect(service.toasts()[0].countdownSeconds).toBe(2);

        service.dismiss(id);
    });

    it('does not touch other toasts inside the countdown interval', () => {
        service.toast({ title: 'Plain', duration: 5000 });
        service.toast({ title: 'Tick', duration: 5000, showCountdown: true });

        vi.advanceTimersByTime(1000);

        const plain = service.toasts().find(t => t.title === 'Plain');
        const tick = service.toasts().find(t => t.title === 'Tick');
        expect(plain?.countdownSeconds).toBeUndefined();
        expect(tick?.countdownSeconds).toBe(4);
    });

    it('auto-dismisses when the duration timeout fires', () => {
        service.toast({ title: 'Auto', duration: 2000 });
        expect(service.toasts()).toHaveLength(1);
        vi.advanceTimersByTime(2000);
        expect(service.toasts()).toHaveLength(0);
    });

    it('does not schedule a timeout when duration is 0', () => {
        service.toast({ title: 'Sticky', duration: 0 });
        vi.advanceTimersByTime(100000);
        expect(service.toasts()).toHaveLength(1);
    });

    it('dismiss clears both the timeout and the countdown interval', () => {
        const id = service.toast({ title: 'Tick', duration: 5000, showCountdown: true });
        expect(vi.getTimerCount()).toBeGreaterThan(0);
        service.dismiss(id);
        expect(service.toasts()).toHaveLength(0);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('dismiss is a no-op for an unknown id (no timers registered)', () => {
        service.dismiss('missing');
        expect(service.toasts()).toHaveLength(0);
    });

    it('dismissAll clears every pending timeout and interval', () => {
        service.toast({ title: 'A', duration: 5000, showCountdown: true });
        service.toast({ title: 'B', duration: 5000 });
        expect(vi.getTimerCount()).toBeGreaterThan(0);

        service.dismissAll();
        expect(service.toasts()).toHaveLength(0);
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe('ToastComponent — progress bar', () => {
    async function make(inputs: Record<string, unknown>) {
        await TestBed.configureTestingModule({
            imports: [ToastComponent],
        }).compileComponents();
        const fixture = TestBed.createComponent(ToastComponent);
        for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
        fixture.detectChanges();
        return fixture;
    }

    it('renders a progress bar at the computed width when counting down', async () => {
        const fixture = await make({
            showCountdown: true,
            duration: 5000,
            countdownSeconds: 3,
        });
        const bar = fixture.debugElement.query(By.css('[data-slot="toast-progress"] > div'));
        expect(bar).toBeTruthy();
        expect((bar.nativeElement as HTMLElement).style.width).toBe('60%');
    });

    it('clamps progress to zero once the countdown reaches zero', async () => {
        const fixture = await make({
            showCountdown: true,
            duration: 5000,
            countdownSeconds: 0,
        });
        const bar = fixture.debugElement.query(By.css('[data-slot="toast-progress"] > div'));
        expect((bar.nativeElement as HTMLElement).style.width).toBe('0%');
    });

    it('reports zero progress when countdownSeconds is absent', async () => {
        const fixture = await make({ showCountdown: true, duration: 5000 });
        const bar = fixture.debugElement.query(By.css('[data-slot="toast-progress"] > div'));
        expect((bar.nativeElement as HTMLElement).style.width).toBe('0%');
    });

    it('omits the progress bar when showCountdown is false', async () => {
        const fixture = await make({ duration: 5000 });
        const bar = fixture.debugElement.query(By.css('[data-slot="toast-progress"]'));
        expect(bar).toBeNull();
    });
});

describe('ToasterComponent', () => {
    let fixture: ComponentFixture<ToasterComponent>;
    let service: ToastService;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ToasterComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(ToasterComponent);
        service = TestBed.inject(ToastService);
        service.dismissAll();
        fixture.detectChanges();
    });

    it('should render container', () => {
        const container = fixture.debugElement.query(By.css('[data-slot="toaster"]'));
        expect(container).toBeTruthy();
    });

    it('should render toasts from service', () => {
        service.toast({ title: 'Toast 1' });
        fixture.detectChanges();

        const toasts = fixture.debugElement.queryAll(By.directive(ToastComponent));
        expect(toasts).toHaveLength(1);
        expect(toasts[0].nativeElement.textContent).toContain('Toast 1');
    });

    it('should apply positioning classes', () => {
        fixture.componentRef.setInput('vertical', 'top');
        fixture.componentRef.setInput('horizontal', 'start');
        fixture.detectChanges();

        const container = fixture.debugElement.query(By.css('[data-slot="toaster"]'));
        expect(container.nativeElement.className).toContain('top-0');
        expect(container.nativeElement.className).toContain('ltr:left-0');
    });
});

@Component({
    template: `
    <div [dir]="dir()">
      <ui-toaster horizontal="end"></ui-toaster>
    </div>
  `,
    imports: [ToasterComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('Toast RTL Support', () => {
    let fixture: ComponentFixture<RTLTestHostComponent>;
    let component: RTLTestHostComponent;
    let service: ToastService;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RTLTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(RTLTestHostComponent);
        component = fixture.componentInstance;
        service = TestBed.inject(ToastService);
        service.dismissAll();
        fixture.detectChanges();
    });

    it('should mirror position in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const toaster = fixture.debugElement.query(By.css('[data-slot="toaster"]'));
        expect(toaster.nativeElement.className).toContain('ltr:right-0');
        expect(toaster.nativeElement.className).toContain('rtl:left-0');
    });
});

describe('ToastComponent — i18n integration', () => {
    async function setup(locale?: string, providerLocale?: string) {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [ToastComponent],
            providers: providerLocale ? [provideUiLocale(providerLocale)] : [],
        }).compileComponents();
        const fixture = TestBed.createComponent(ToastComponent);
        if (locale) fixture.componentRef.setInput('locale', locale);
        fixture.detectChanges();
        return fixture;
    }

    it('defaults the close-button aria-label to English "Close"', async () => {
        const fixture = await setup();
        const btn = fixture.debugElement.query(By.css('button[aria-label]'));
        expect(btn.nativeElement.getAttribute('aria-label')).toBe('Close');
        const root = fixture.debugElement.query(By.css('[data-slot="toast"]'));
        expect(root.nativeElement.hasAttribute('dir')).toBe(false);
    });

    it('localises the close aria-label and applies dir="rtl" when locale="he"', async () => {
        const fixture = await setup('he');
        const btn = fixture.debugElement.query(By.css('button[aria-label]'));
        expect(btn.nativeElement.getAttribute('aria-label')).toBe('סגור');
        const root = fixture.debugElement.query(By.css('[data-slot="toast"]'));
        expect(root.nativeElement.getAttribute('dir')).toBe('rtl');
    });

    it('falls back to UI_LOCALE_ID when no locale input is set', async () => {
        const fixture = await setup(undefined, 'de');
        const btn = fixture.debugElement.query(By.css('button[aria-label]'));
        expect(btn.nativeElement.getAttribute('aria-label')).toBe('Schließen');
    });
});
