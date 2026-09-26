import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TooltipComponent, TooltipTriggerComponent, TooltipContentComponent, TooltipDirective } from './index';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

    it('should not show content when closed', () => {
        const content = fixture.debugElement.query(By.css('[data-slot="tooltip-content"]'));
        expect(content).toBeNull();
    });

    it('renders the projected content once the tooltip opens', async () => {
        const tooltipComp = fixture.debugElement.query(By.directive(TooltipComponent));
        tooltipComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="tooltip-content"]'));
        expect(content).toBeTruthy();
    });
});

@Component({
    template: `
        <div data-ui-theme="red" style="--primary: rgb(1, 2, 3); --primary-foreground: rgb(4, 5, 6)">
            <button [uiTooltip]="'Themed tip'">Hover me</button>
        </div>
    `,
    imports: [TooltipDirective]
})
class ThemedDirectiveHost { }

describe('TooltipDirective inside a themed component', () => {
    afterEach(() => {
        vi.useRealTimers();
        document.querySelectorAll('body > div').forEach(el => {
            if (el.textContent === 'Themed tip') el.remove();
        });
    });

    it('carries the theme tokens onto the bubble it appends to document.body', (ctx) => {
        if (navigator.userAgent.includes('jsdom')) return ctx.skip();
        vi.useFakeTimers();
        const fixture = TestBed.createComponent(ThemedDirectiveHost);
        fixture.detectChanges();
        const directive = fixture.debugElement.query(By.directive(TooltipDirective)).injector.get(TooltipDirective);

        directive.onMouseEnter();
        vi.advanceTimersByTime(200);

        const bubble = Array.from(document.body.children).find(el => el.textContent === 'Themed tip') as HTMLElement | undefined;
        expect(bubble?.parentElement).toBe(document.body);
        expect(bubble?.style.getPropertyValue('--primary')).toBe('rgb(1, 2, 3)');
        expect(bubble?.style.getPropertyValue('--primary-foreground')).toBe('rgb(4, 5, 6)');
    });
});

describe('Tooltip Content without a tooltip parent', () => {
    it('falls back to the top side classes when no TOOLTIP is provided', async () => {
        await TestBed.configureTestingModule({
            imports: [TooltipContentComponent]
        }).compileComponents();

        const fixture = TestBed.createComponent(TooltipContentComponent);
        expect(fixture.componentInstance.tooltip).toBeNull();
        expect(fixture.componentInstance.classes()).toContain('bottom-full');
    });
});

// Simple content mode test host
@Component({
    template: `
        <ui-tooltip content="Simple tooltip text">
            <ui-tooltip-trigger>
                <button>Hover me</button>
            </ui-tooltip-trigger>
        </ui-tooltip>
    `,
    imports: [TooltipComponent, TooltipTriggerComponent]
})
class SimpleContentTestHostComponent { }

describe('Tooltip Simple Content Mode', () => {
    let fixture: ComponentFixture<SimpleContentTestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SimpleContentTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SimpleContentTestHostComponent);
        fixture.detectChanges();
    });

    it('should auto-render tooltip content from content input', async () => {
        const tooltipComp = fixture.debugElement.query(By.directive(TooltipComponent));
        tooltipComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const tooltipContent = fixture.debugElement.query(By.css('[data-slot="tooltip-content"]'));
        expect(tooltipContent).toBeTruthy();
        expect(tooltipContent.nativeElement.textContent).toContain('Simple tooltip text');
    });
});
