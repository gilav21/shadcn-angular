import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastService, ToastComponent } from './toast.component';
import { ToasterComponent } from './sub/toaster.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';

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
