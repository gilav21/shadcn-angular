import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ToastService, ToasterComponent, ToastComponent } from './toast.component';
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
        expect(service.toasts().length).toBe(1);
        expect(service.toasts()[0].title).toBe('Test');
    });

    it('should dismiss a toast by id', () => {
        const id = service.toast({ title: 'Test' });
        service.dismiss(id);
        expect(service.toasts().length).toBe(0);
    });

    it('should auto-dismiss after duration', async () => {
        service.toast({ title: 'Auto', duration: 100 });
        expect(service.toasts().length).toBe(1);

        await new Promise(resolve => setTimeout(resolve, 150));
        expect(service.toasts().length).toBe(0);
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
        expect(toasts.length).toBe(1);
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
