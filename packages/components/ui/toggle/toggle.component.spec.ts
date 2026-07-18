import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToggleComponent } from './toggle.component';
import {
    Component,
    signal,
    createComponent,
    inputBinding,
    EnvironmentInjector,
} from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// RTL Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-toggle (pressedChange)="onPress($event)">Toggle</ui-toggle>
        </div>
    `,
    imports: [ToggleComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
    pressed = false;
    onPress(value: boolean) {
        this.pressed = value;
    }
}

describe('ToggleComponent', () => {
    let component: ToggleComponent;
    let fixture: ComponentFixture<ToggleComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ToggleComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(ToggleComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="toggle"', () => {
        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.dataset.slot).toBe('toggle');
    });

    it('should have aria-pressed="false" by default', () => {
        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.getAttribute('aria-pressed')).toBe('false');
    });

    it('should have data-state="off" by default', () => {
        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.dataset.state).toBe('off');
    });

    it('should toggle on click', async () => {
        const button = fixture.debugElement.query(By.css('button'));
        button.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.pressed()).toBe(true);
        expect(button.nativeElement.getAttribute('aria-pressed')).toBe('true');
        expect(button.nativeElement.dataset.state).toBe('on');
    });

    it('should not toggle when disabled', async () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        await fixture.whenStable();

        const button = fixture.debugElement.query(By.css('button'));
        button.nativeElement.click();
        fixture.detectChanges();

        expect(component.pressed()).toBe(false);
    });

    it('should apply default variant classes', () => {
        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.className).toContain('bg-transparent');
    });

    it('should apply outline variant classes', () => {
        fixture.componentRef.setInput('variant', 'outline');
        fixture.detectChanges();

        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.className).toContain('border');
    });

    it('should apply small size classes', () => {
        fixture.componentRef.setInput('size', 'sm');
        fixture.detectChanges();

        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.getAttribute('data-size')).toBe('sm');
    });

    it('should apply large size classes', () => {
        fixture.componentRef.setInput('size', 'lg');
        fixture.detectChanges();

        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.getAttribute('data-size')).toBe('lg');
    });

    it('should be disabled when disabled input is true', async () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        await fixture.whenStable();

        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.disabled).toBe(true);
    });

    it('should toggle on touchend and prevent default', () => {
        const button = fixture.debugElement.query(By.css('button'));
        let preventedDefault = false;
        const event = {
            preventDefault: () => {
                preventedDefault = true;
            },
        } as unknown as TouchEvent;

        component.onTouchEnd(event);
        fixture.detectChanges();

        expect(preventedDefault).toBe(true);
        expect(component.pressed()).toBe(true);
        expect(button.nativeElement.getAttribute('aria-pressed')).toBe('true');
    });

    it('should not toggle on touchend when disabled', () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();

        let preventedDefault = false;
        const event = {
            preventDefault: () => {
                preventedDefault = true;
            },
        } as unknown as TouchEvent;

        component.onTouchEnd(event);

        expect(preventedDefault).toBe(false);
        expect(component.pressed()).toBe(false);
    });

    it('should suppress the synthetic click that follows a touch toggle', () => {
        const event = {
            preventDefault: () => {
                /* noop */
            },
        } as unknown as TouchEvent;

        component.onTouchEnd(event);
        expect(component.pressed()).toBe(true);

        component.onClick();

        expect(component.pressed()).toBe(true);
    });

    it('should not toggle on click when disabled', () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();

        component.onClick();

        expect(component.pressed()).toBe(false);
    });

    it('setPressed should update the pressed state', () => {
        component.setPressed(true);
        fixture.detectChanges();
        expect(component.pressed()).toBe(true);

        component.setPressed(false);
        fixture.detectChanges();
        expect(component.pressed()).toBe(false);
    });
});

describe('ToggleComponent defaultPressed', () => {
    it('seeds pressed from defaultPressed once inputs are bound (ngOnInit)', async () => {
        await TestBed.configureTestingModule({}).compileComponents();
        const environmentInjector = TestBed.inject(EnvironmentInjector);

        const ref = createComponent(ToggleComponent, {
            environmentInjector,
            bindings: [inputBinding('defaultPressed', () => true)],
        });
        ref.changeDetectorRef.detectChanges();

        expect(ref.instance.defaultPressed()).toBe(true);
        expect(ref.instance.pressed()).toBe(true);
        ref.destroy();
    });

    it('leaves pressed false when defaultPressed is not set', async () => {
        await TestBed.configureTestingModule({}).compileComponents();
        const environmentInjector = TestBed.inject(EnvironmentInjector);

        const ref = createComponent(ToggleComponent, { environmentInjector });
        ref.changeDetectorRef.detectChanges();

        expect(ref.instance.pressed()).toBe(false);
        ref.destroy();
    });
});

describe('Toggle RTL Support', () => {
    let fixture: ComponentFixture<RTLTestHostComponent>;
    let component: RTLTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RTLTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(RTLTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        document.documentElement.removeAttribute('dir');
    });

    it('should render in LTR mode', () => {
        const container = fixture.debugElement.query(By.css('[dir="ltr"]'));
        expect(container).toBeTruthy();
    });

    it('should render in RTL mode', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const container = fixture.debugElement.query(By.css('[dir="rtl"]'));
        expect(container).toBeTruthy();
    });

    it('should emit pressedChange in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const button = fixture.debugElement.query(By.css('button'));
        button.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.pressed).toBe(true);
    });
});
