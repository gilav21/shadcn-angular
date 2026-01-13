import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TooltipComponent, TooltipTriggerComponent, TooltipContentComponent, TooltipDirective } from './tooltip.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Test host for integration
@Component({
    template: `
        <ui-tooltip>
            <ui-tooltip-trigger>Hover me</ui-tooltip-trigger>
            <ui-tooltip-content>Tooltip text</ui-tooltip-content>
        </ui-tooltip>
    `,
    imports: [TooltipComponent, TooltipTriggerComponent, TooltipContentComponent]
})
class TestHostComponent { }

// Directive test host
@Component({
    template: `<button [uiTooltip]="'Directive tooltip'">Hover me</button>`,
    imports: [TooltipDirective]
})
class DirectiveTestHost { }

// RTL Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-tooltip>
                <ui-tooltip-trigger>تحويم</ui-tooltip-trigger>
                <ui-tooltip-content>نص التلميح</ui-tooltip-content>
            </ui-tooltip>
        </div>
    `,
    imports: [TooltipComponent, TooltipTriggerComponent, TooltipContentComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('TooltipComponent', () => {
    let component: TooltipComponent;
    let fixture: ComponentFixture<TooltipComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TooltipComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TooltipComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should be closed by default', () => {
        expect(component.open()).toBe(false);
    });

    it('should have default side="top"', () => {
        expect(component.side()).toBe('top');
    });

    it('should show when show() is called', () => {
        component.show();
        expect(component.open()).toBe(true);
    });

    it('should hide when hide() is called', () => {
        component.show();
        component.hide();
        expect(component.open()).toBe(false);
    });
});

describe('Tooltip Integration', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('should render trigger', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="tooltip-trigger"]'));
        expect(trigger).toBeTruthy();
    });

    it('should not show content when closed', () => {
        const content = fixture.debugElement.query(By.css('[data-slot="tooltip-content"]'));
        expect(content).toBeNull();
    });

    it('should show content on focus', async () => {
        const tooltipComp = fixture.debugElement.query(By.directive(TooltipComponent));
        tooltipComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="tooltip-content"]'));
        expect(content).toBeTruthy();
    });

    it('should apply positioning classes for top', async () => {
        const tooltipComp = fixture.debugElement.query(By.directive(TooltipComponent));
        tooltipComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="tooltip-content"]'));
        expect(content.nativeElement.className).toContain('bottom-full');
    });
});

describe('TooltipDirective', () => {
    let fixture: ComponentFixture<DirectiveTestHost>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DirectiveTestHost]
        }).compileComponents();

        fixture = TestBed.createComponent(DirectiveTestHost);
        fixture.detectChanges();
    });

    it('should create directive on element', () => {
        const button = fixture.debugElement.query(By.directive(TooltipDirective));
        expect(button).toBeTruthy();
    });
});

describe('Tooltip RTL Support', () => {
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

    it('should show tooltip in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const tooltipComp = fixture.debugElement.query(By.directive(TooltipComponent));
        tooltipComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="tooltip-content"]'));
        expect(content).toBeTruthy();
    });
});
