import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SheetComponent, SheetTriggerComponent, SheetContentComponent, SheetHeaderComponent, SheetTitleComponent, SheetDescriptionComponent, SheetFooterComponent, SheetCloseComponent } from '../sheet';
import { SHEET } from '../sheet';
import { Component, signal, WritableSignal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type MockSheet = { open: WritableSignal<boolean>; hide: () => void };

/** Build a KeyboardEvent whose target / currentTarget are explicitly set. */
function keyEvent(key: string, target: EventTarget, currentTarget: EventTarget, shiftKey = false): KeyboardEvent {
    const ev = new KeyboardEvent('keydown', { key, shiftKey });
    Object.defineProperty(ev, 'target', { value: target, configurable: true });
    Object.defineProperty(ev, 'currentTarget', { value: currentTarget, configurable: true });
    return ev;
}

// Test host for integration
@Component({
    template: `
        <ui-sheet (openChange)="onOpenChange($event)">
            <ui-sheet-trigger>Open</ui-sheet-trigger>
            <ui-sheet-content side="right">
                <ui-sheet-header>
                    <ui-sheet-title>Title</ui-sheet-title>
                    <ui-sheet-description>Description</ui-sheet-description>
                </ui-sheet-header>
                Content
                <ui-sheet-footer>
                    <ui-sheet-close>Close</ui-sheet-close>
                </ui-sheet-footer>
            </ui-sheet-content>
        </ui-sheet>
    `,
    imports: [SheetComponent, SheetTriggerComponent, SheetContentComponent, SheetHeaderComponent, SheetTitleComponent, SheetDescriptionComponent, SheetFooterComponent, SheetCloseComponent]
})
class TestHostComponent {
    isOpen = false;
    onOpenChange(open: boolean) {
        this.isOpen = open;
    }
}

describe('SheetComponent', () => {
    let component: SheetComponent;
    let fixture: ComponentFixture<SheetComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SheetComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SheetComponent);
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

    it('should toggle open state', () => {
        component.toggle();
        expect(component.open()).toBe(true);
        component.toggle();
        expect(component.open()).toBe(false);
    });
});

describe('Sheet Integration', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let component: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should not show content when closed', () => {
        const content = fixture.debugElement.query(By.css('[data-slot="sheet-content"]'));
        expect(content).toBeNull();
    });

    it('should show content on trigger click', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="sheet-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="sheet-content"]'));
        expect(content).toBeTruthy();
        expect(component.isOpen).toBe(true);
    });

    it('should render header and title', async () => {
        const sheetComp = fixture.debugElement.query(By.directive(SheetComponent));
        sheetComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const header = fixture.debugElement.query(By.css('[data-slot="sheet-header"]'));
        expect(header).toBeTruthy();

        const title = fixture.debugElement.query(By.css('[data-slot="sheet-title"]'));
        expect(title.nativeElement.textContent).toContain('Title');
    });

    it('should close on close button click', async () => {
        const sheetComp = fixture.debugElement.query(By.directive(SheetComponent));
        sheetComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const close = fixture.debugElement.query(By.css('[data-slot="sheet-close"]'));
        close.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="sheet-content"]'));
        expect(content).toBeNull();
    });

    it('should close on Escape key', async () => {
        const sheetComp = fixture.debugElement.query(By.directive(SheetComponent));
        sheetComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const dialog = fixture.debugElement.query(By.css('[role="dialog"]'));
        dialog.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        fixture.detectChanges();

        expect(component.isOpen).toBe(false);
    });

    it('should close on overlay click', async () => {
        const sheetComp = fixture.debugElement.query(By.directive(SheetComponent));
        sheetComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const overlay = fixture.debugElement.query(By.css('[data-slot="sheet-overlay"]'));
        overlay.nativeElement.click();
        fixture.detectChanges();

        expect(component.isOpen).toBe(false);
    });
});

// Simple mode test host
@Component({
    template: `
        <ui-sheet>
            <ui-sheet-trigger>Open</ui-sheet-trigger>
            <ui-sheet-content side="right" title="Settings" description="Manage preferences.">
                <p>Body content</p>
            </ui-sheet-content>
        </ui-sheet>
    `,
    imports: [SheetComponent, SheetTriggerComponent, SheetContentComponent]
})
class SimpleModeTestHostComponent { }

describe('Sheet Simple Mode', () => {
    let fixture: ComponentFixture<SimpleModeTestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SimpleModeTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SimpleModeTestHostComponent);
        fixture.detectChanges();
    });

    it('should auto-render header with title input', async () => {
        const sheetComp = fixture.debugElement.query(By.directive(SheetComponent));
        sheetComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const title = fixture.debugElement.query(By.css('[data-slot="sheet-title"]'));
        expect(title).toBeTruthy();
        expect(title.nativeElement.textContent).toContain('Settings');

        const desc = fixture.debugElement.query(By.css('[data-slot="sheet-description"]'));
        expect(desc).toBeTruthy();
        expect(desc.nativeElement.textContent).toContain('Manage preferences.');

        const content = fixture.debugElement.query(By.css('[data-slot="sheet-content"]'));
        expect(content.nativeElement.textContent).toContain('Body content');
    });
});

describe('SheetContentComponent — i18n integration', () => {
    @Component({
        template: `
            <ui-sheet>
                <ui-sheet-content [locale]="locale">Hi</ui-sheet-content>
            </ui-sheet>
        `,
        imports: [SheetComponent, SheetContentComponent],
    })
    class SheetI18nHost {
        locale: string | undefined = undefined;
    }

    async function setup(locale?: string, providerLocale?: string) {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [SheetI18nHost],
            providers: providerLocale ? [provideUiLocale(providerLocale)] : [],
        }).compileComponents();
        const fixture = TestBed.createComponent(SheetI18nHost);
        if (locale) fixture.componentInstance.locale = locale;
        fixture.detectChanges();
        const sheet = fixture.debugElement.query(By.directive(SheetComponent)).componentInstance as SheetComponent;
        sheet.show();
        fixture.detectChanges();
        await fixture.whenStable();
        return fixture;
    }

    it('renders English "Close" by default', async () => {
        const fixture = await setup();
        const closeBtn = fixture.debugElement.query(By.css('[aria-label]'));
        expect(closeBtn.nativeElement.getAttribute('aria-label')).toBe('Close');
    });

    it('renders Hebrew + RTL when locale="he"', async () => {
        const fixture = await setup('he');
        const closeBtn = fixture.debugElement.query(By.css('button[aria-label]'));
        expect(closeBtn.nativeElement.getAttribute('aria-label')).toBe('סגור');
        const wrapper = fixture.debugElement.query(By.css('[dir]'));
        expect(wrapper.nativeElement.getAttribute('dir')).toBe('rtl');
    });

    it('falls back to UI_LOCALE_ID when no locale input is set', async () => {
        const fixture = await setup(undefined, 'fr');
        const closeBtn = fixture.debugElement.query(By.css('button[aria-label]'));
        expect(closeBtn.nativeElement.getAttribute('aria-label')).toBe('Fermer');
    });
});

describe('Sheet Trigger / Close keyboard activation', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
        await fixture.whenStable();
    });

    it('toggles the sheet when Enter is pressed on the trigger', async () => {
        const triggerEl = fixture.debugElement.query(By.css('[data-slot="sheet-trigger"]'));
        triggerEl.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="sheet-content"]'));
        expect(content).toBeTruthy();
    });

    it('ignores trigger keydown that bubbles from an inner element', () => {
        const sheetComp = fixture.debugElement.query(By.directive(SheetComponent)).componentInstance as SheetComponent;
        const triggerComp = fixture.debugElement.query(By.directive(SheetTriggerComponent)).componentInstance as SheetTriggerComponent;
        const span = fixture.debugElement.query(By.css('[data-slot="sheet-trigger"]')).nativeElement as HTMLElement;
        const inner = document.createElement('button');
        span.appendChild(inner);

        triggerComp.onKeydown(keyEvent('Enter', inner, span));

        expect(sheetComp.open()).toBe(false);
    });

    it('hides the sheet when Enter is pressed on the close control', async () => {
        const sheetComp = fixture.debugElement.query(By.directive(SheetComponent)).componentInstance as SheetComponent;
        sheetComp.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const closeEl = fixture.debugElement.query(By.css('[data-slot="sheet-close"]'));
        closeEl.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        fixture.detectChanges();
        await fixture.whenStable();

        expect(sheetComp.open()).toBe(false);
    });

    it('ignores close keydown that bubbles from an inner element', async () => {
        const sheetComp = fixture.debugElement.query(By.directive(SheetComponent)).componentInstance as SheetComponent;
        sheetComp.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const closeComp = fixture.debugElement.query(By.directive(SheetCloseComponent)).componentInstance as SheetCloseComponent;
        const span = fixture.debugElement.query(By.css('[data-slot="sheet-close"]')).nativeElement as HTMLElement;
        const inner = document.createElement('button');
        span.appendChild(inner);

        closeComp.onKeydown(keyEvent('Enter', inner, span));
        fixture.detectChanges();

        expect(sheetComp.open()).toBe(true);
    });
});

// Host that renders content directly against a mock SHEET already open.
@Component({
    template: `
        <ui-sheet-content title="Trap" description="Trapped">
            <button data-testid="first">First</button>
            <button data-testid="last">Last</button>
        </ui-sheet-content>
    `,
    imports: [SheetContentComponent],
})
class TrapHostComponent { }

describe('Sheet Content focus trap & close button', () => {
    let fixture: ComponentFixture<TrapHostComponent>;
    let mockSheet: MockSheet;

    beforeEach(async () => {
        mockSheet = { open: signal(true), hide: vi.fn() };
        await TestBed.configureTestingModule({
            imports: [TrapHostComponent],
            providers: [{ provide: SHEET, useValue: mockSheet }],
        }).compileComponents();
        fixture = TestBed.createComponent(TrapHostComponent);
        fixture.detectChanges();
        await fixture.whenStable();
    });

    function focusables(): HTMLElement[] {
        const content = fixture.nativeElement.querySelector('[data-slot="sheet-content"]') as HTMLElement;
        return Array.from(
            content.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        );
    }

    it('focuses the first focusable element on open (ngAfterViewInit)', () => {
        const first = focusables()[0];
        expect(document.activeElement).toBe(first);
    });

    it('routes Tab and Shift+Tab on the panel through the focus trap', () => {
        const els = focusables();
        const first = els[0];
        const last = els.at(-1) as HTMLElement;

        last.focus();
        last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        expect(document.activeElement).toBe(first);

        first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
        expect(document.activeElement).toBe(last);
    });

    it('hides the sheet via the X close button click (close())', () => {
        const closeBtn = fixture.debugElement.query(By.css('button[aria-label]'));
        closeBtn.nativeElement.click();
        expect(mockSheet.hide).toHaveBeenCalled();
    });
});

// Host with no projected focusable content, mock sheet starts closed.
@Component({
    template: `<ui-sheet-content>Just text</ui-sheet-content>`,
    imports: [SheetContentComponent],
})
class NoFocusableHostComponent { }

describe('Sheet Content — falls back to focusing the container', () => {
    let mockSheet: MockSheet;

    afterEach(() => {
        vi.useRealTimers();
    });

    it('focuses the content container when no focusable child exists', async () => {
        mockSheet = { open: signal(false), hide: vi.fn() };
        await TestBed.configureTestingModule({
            imports: [NoFocusableHostComponent],
            providers: [{ provide: SHEET, useValue: mockSheet }],
        }).compileComponents();
        const fixture = TestBed.createComponent(NoFocusableHostComponent);
        fixture.detectChanges();

        vi.useFakeTimers();
        mockSheet.open.set(true);
        fixture.detectChanges();

        const content = fixture.nativeElement.querySelector('[data-slot="sheet-content"]') as HTMLElement;
        content.querySelector('button')?.remove();

        vi.advanceTimersByTime(5);

        expect(document.activeElement).toBe(content);
    });
});
