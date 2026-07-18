import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DialogComponent, DialogTriggerComponent, DialogContentComponent, DialogHeaderComponent, DialogTitleComponent, DialogDescriptionComponent, DialogFooterComponent } from './index';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Test host for integration
@Component({
    template: `
        <ui-dialog>
            <ui-dialog-trigger>Open</ui-dialog-trigger>
            <ui-dialog-content>
                <ui-dialog-header>
                    <ui-dialog-title>Title</ui-dialog-title>
                    <ui-dialog-description>Description</ui-dialog-description>
                </ui-dialog-header>
                Content
                <ui-dialog-footer>Footer</ui-dialog-footer>
            </ui-dialog-content>
        </ui-dialog>
    `,
    imports: [DialogComponent, DialogTriggerComponent, DialogContentComponent, DialogHeaderComponent, DialogTitleComponent, DialogDescriptionComponent, DialogFooterComponent]
})
class TestHostComponent { }

// RTL Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-dialog>
                <ui-dialog-trigger>فتح</ui-dialog-trigger>
                <ui-dialog-content>محتوى</ui-dialog-content>
            </ui-dialog>
        </div>
    `,
    imports: [DialogComponent, DialogTriggerComponent, DialogContentComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('DialogComponent', () => {
    let component: DialogComponent;
    let fixture: ComponentFixture<DialogComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DialogComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(DialogComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should be closed by default', () => {
        expect(component.open()).toBe(false);
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

describe('Dialog Integration', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('should render trigger', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="dialog-trigger"]'));
        expect(trigger).toBeTruthy();
    });

    it('should not show content when closed', () => {
        const content = fixture.debugElement.query(By.css('[data-slot="dialog-content"]'));
        expect(content).toBeNull();
    });

    it('should show content on trigger click', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="dialog-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="dialog-content"]'));
        expect(content).toBeTruthy();
    });

    it('should render dialog header', async () => {
        const dialogComp = fixture.debugElement.query(By.directive(DialogComponent));
        dialogComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const header = fixture.debugElement.query(By.css('[data-slot="dialog-header"]'));
        expect(header).toBeTruthy();
    });

    it('should render dialog title', async () => {
        const dialogComp = fixture.debugElement.query(By.directive(DialogComponent));
        dialogComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const title = fixture.debugElement.query(By.css('[data-slot="dialog-title"]'));
        expect(title).toBeTruthy();
        expect(title.nativeElement.textContent).toContain('Title');
    });

    it('should render dialog description', async () => {
        const dialogComp = fixture.debugElement.query(By.directive(DialogComponent));
        dialogComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const desc = fixture.debugElement.query(By.css('[data-slot="dialog-description"]'));
        expect(desc).toBeTruthy();
    });

    it('should close on escape key', async () => {
        const dialogComp = fixture.debugElement.query(By.directive(DialogComponent));
        dialogComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="dialog-content"]'));
        expect(content).toBeTruthy();

        content.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        fixture.detectChanges();
        await fixture.whenStable();

        const contentAfter = fixture.debugElement.query(By.css('[data-slot="dialog-content"]'));
        expect(contentAfter).toBeNull();
    });

    it('should close on overlay click', async () => {
        const dialogComp = fixture.debugElement.query(By.directive(DialogComponent));
        dialogComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        // The overlay is usually the host of content or a sibling. 
        // In this implementation, DialogContent might include the overlay or be wrapped.
        // Let's check the template structure. usually ui-dialog-content renders the overlay.
        // <div data-slot="dialog-overlay" ... (click)="close()">

        const overlay = fixture.debugElement.query(By.css('[data-slot="dialog-overlay"]'));
        expect(overlay).toBeTruthy();

        overlay.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const contentAfter = fixture.debugElement.query(By.css('[data-slot="dialog-content"]'));
        expect(contentAfter).toBeNull();
    });

    it('should not close when clicking content', async () => {
        const dialogComp = fixture.debugElement.query(By.directive(DialogComponent));
        dialogComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="dialog-content"]'));
        content.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const contentAfter = fixture.debugElement.query(By.css('[data-slot="dialog-content"]'));
        expect(contentAfter).toBeTruthy();
    });

    // Note: Testing actual focus trap and scroll locking usually requires a real browser environment 
    // or careful mocking of document/window, which might be flaky in standard unit tests.
    // However, we can check if the methods/logic are triggered.
    // implementing a simple check for body style overflow for scroll locking.

    it('should lock body scroll when open', async () => {
        const dialogComp = fixture.debugElement.query(By.directive(DialogComponent));
        dialogComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(document.body.style.overflow).toBe('hidden');

        dialogComp.componentInstance.hide();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(document.body.style.overflow).toBe('');
    });
});

describe('Dialog RTL Support', () => {
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

    it('should open dialog in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const trigger = fixture.debugElement.query(By.css('[data-slot="dialog-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="dialog-content"]'));
        expect(content).toBeTruthy();
    });
});

// Simple mode test host
@Component({
    template: `
        <ui-dialog>
            <ui-dialog-trigger>Open</ui-dialog-trigger>
            <ui-dialog-content title="Simple Title" description="Simple Description">
                <p>Body content</p>
            </ui-dialog-content>
        </ui-dialog>
    `,
    imports: [DialogComponent, DialogTriggerComponent, DialogContentComponent]
})
class SimpleModeTestHostComponent { }

describe('Dialog Simple Mode', () => {
    let fixture: ComponentFixture<SimpleModeTestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SimpleModeTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SimpleModeTestHostComponent);
        fixture.detectChanges();
    });

    it('should auto-render header with title input', async () => {
        const dialogComp = fixture.debugElement.query(By.directive(DialogComponent));
        dialogComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const title = fixture.debugElement.query(By.css('[data-slot="dialog-title"]'));
        expect(title).toBeTruthy();
        expect(title.nativeElement.textContent).toContain('Simple Title');
    });

    it('should auto-render description input', async () => {
        const dialogComp = fixture.debugElement.query(By.directive(DialogComponent));
        dialogComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const desc = fixture.debugElement.query(By.css('[data-slot="dialog-description"]'));
        expect(desc).toBeTruthy();
        expect(desc.nativeElement.textContent).toContain('Simple Description');
    });

    it('should still render projected body content', async () => {
        const dialogComp = fixture.debugElement.query(By.directive(DialogComponent));
        dialogComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="dialog-content"]'));
        expect(content.nativeElement.textContent).toContain('Body content');
    });
});

describe('DialogContentComponent — i18n integration', () => {
    @Component({
        template: `
            <ui-dialog>
                <ui-dialog-content [locale]="locale">Hello</ui-dialog-content>
            </ui-dialog>
        `,
        imports: [DialogComponent, DialogContentComponent],
    })
    class I18nHost {
        locale: string | undefined = undefined;
    }

    async function setup(locale?: string, providerLocale?: string) {
        await TestBed.configureTestingModule({
            imports: [I18nHost],
            providers: providerLocale ? [(await import('../../lib/i18n')).provideUiLocale(providerLocale)] : [],
        }).compileComponents();
        const fixture = TestBed.createComponent(I18nHost);
        if (locale) fixture.componentInstance.locale = locale;
        fixture.detectChanges();
        const dialog = fixture.debugElement.query(By.directive(DialogComponent)).componentInstance as DialogComponent;
        dialog.show();
        fixture.detectChanges();
        await fixture.whenStable();
        return fixture;
    }

    afterEach(() => {
        document.body.style.overflow = '';
    });

    it('renders English "Close" by default', async () => {
        const fixture = await setup();
        const sr = fixture.debugElement.query(By.css('[data-slot="dialog-content"] .sr-only'));
        expect(sr.nativeElement.textContent.trim()).toBe('Close');
    });

    it('renders Hebrew + RTL when locale="he"', async () => {
        const fixture = await setup('he');
        const sr = fixture.debugElement.query(By.css('[data-slot="dialog-content"] .sr-only'));
        expect(sr.nativeElement.textContent.trim()).toBe('סגור');
        const closeBtn = fixture.debugElement.query(By.css('[data-slot="dialog-content"] button[aria-label]'));
        expect(closeBtn.nativeElement.getAttribute('aria-label')).toBe('סגור');
        const wrapper = fixture.debugElement.query(By.css('[dir]'));
        expect(wrapper.nativeElement.getAttribute('dir')).toBe('rtl');
    });

    it('falls back to UI_LOCALE_ID when no locale input is set', async () => {
        const fixture = await setup(undefined, 'ar');
        const sr = fixture.debugElement.query(By.css('[data-slot="dialog-content"] .sr-only'));
        expect(sr.nativeElement.textContent.trim()).toBe('إغلاق');
    });
});

// Host that opens the dialog before the first change detection so that
// DialogContentComponent.ngAfterViewInit sees dialog.open() === true.
@Component({
    template: `
        <ui-dialog [open]="true">
            <ui-dialog-content>
                Body
                <button data-testid="inner-btn">Action</button>
            </ui-dialog-content>
        </ui-dialog>
    `,
    imports: [DialogComponent, DialogContentComponent],
})
class OpenAtInitHost { }

describe('DialogContentComponent — open before view init', () => {
    afterEach(() => {
        document.body.style.overflow = '';
    });

    it('focuses the first focusable element from ngAfterViewInit when already open', async () => {
        const fixture = TestBed.createComponent(OpenAtInitHost);
        const btn = () => fixture.debugElement.query(By.css('[data-testid="inner-btn"]'));
        // Detect changes triggers ngAfterViewInit with the dialog already open.
        fixture.detectChanges();
        await fixture.whenStable();

        const inner = btn();
        expect(inner).toBeTruthy();
        const focusSpy = vi.spyOn(inner.nativeElement as HTMLElement, 'focus');
        const contentComp = fixture.debugElement
            .query(By.directive(DialogContentComponent))
            .componentInstance as DialogContentComponent;
        contentComp.ngAfterViewInit();
        expect(focusSpy).toHaveBeenCalled();
    });
});

describe('DialogContentComponent — focusFirstElement fallback', () => {
    afterEach(() => {
        document.body.style.overflow = '';
    });

    it('focuses the content container itself when no focusable child exists', async () => {
        const fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
        const dialog = fixture.debugElement
            .query(By.directive(DialogComponent))
            .componentInstance as DialogComponent;
        dialog.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const contentDiv = fixture.debugElement.query(
            By.css('[data-slot="dialog-content"]')
        ).nativeElement as HTMLElement;
        // Strip every focusable element so the fallback branch runs.
        contentDiv
            .querySelectorAll('button, [href], input, select, textarea, [tabindex]')
            .forEach((el) => el.remove());

        const focusSpy = vi.spyOn(contentDiv, 'focus');
        const contentComp = fixture.debugElement
            .query(By.directive(DialogContentComponent))
            .componentInstance as DialogContentComponent;
        (contentComp as unknown as { focusFirstElement(): void }).focusFirstElement();

        expect(focusSpy).toHaveBeenCalled();
    });
});

describe('DialogContentComponent — keyboard focus trap', () => {
    let fixture: ComponentFixture<DialogContentComponent>;
    let component: DialogContentComponent;
    let container: HTMLElement;
    let first: HTMLButtonElement;
    let last: HTMLButtonElement;

    function setContentEl(el: HTMLElement | undefined) {
        (component as unknown as { contentEl?: HTMLElement }).contentEl = el;
    }

    function tab(options: KeyboardEventInit = {}): KeyboardEvent {
        const event = new KeyboardEvent('keydown', { key: 'Tab', ...options });
        const preventSpy = vi.spyOn(event, 'preventDefault');
        component.onKeydown(event);
        return Object.assign(event, { preventSpy }) as KeyboardEvent & {
            preventSpy: ReturnType<typeof vi.spyOn>;
        };
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DialogContentComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(DialogContentComponent);
        component = fixture.componentInstance;

        container = document.createElement('div');
        first = document.createElement('button');
        first.textContent = 'first';
        last = document.createElement('button');
        last.textContent = 'last';
        container.append(first, last);
        document.body.appendChild(container);
        setContentEl(container);
    });

    afterEach(() => {
        container.remove();
        document.body.style.overflow = '';
    });

    it('closes the dialog on Escape and prevents default', () => {
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        const preventSpy = vi.spyOn(event, 'preventDefault');
        component.onKeydown(event);
        expect(preventSpy).toHaveBeenCalled();
    });

    it('ignores non-Tab keys', () => {
        const event = new KeyboardEvent('keydown', { key: 'a' });
        const preventSpy = vi.spyOn(event, 'preventDefault');
        component.onKeydown(event);
        expect(preventSpy).not.toHaveBeenCalled();
    });

    it('does nothing on Tab when contentEl is not set', () => {
        setContentEl(undefined);
        const event = tab();
        expect((event as unknown as { preventSpy: { mock: { calls: unknown[] } } }).preventSpy.mock.calls).toHaveLength(0);
    });

    it('does nothing on Tab when there are no focusable elements', () => {
        setContentEl(document.createElement('div'));
        const event = tab();
        expect((event as unknown as { preventSpy: { mock: { calls: unknown[] } } }).preventSpy.mock.calls).toHaveLength(0);
    });

    it('wraps forward from the last element to the first on Tab', () => {
        last.focus();
        expect(document.activeElement).toBe(last);
        const firstFocus = vi.spyOn(first, 'focus');
        const event = tab();
        expect((event as unknown as { preventSpy: { mock: { calls: unknown[] } } }).preventSpy.mock.calls).toHaveLength(1);
        expect(firstFocus).toHaveBeenCalled();
    });

    it('does not wrap forward when focus is not on the last element', () => {
        first.focus();
        const event = tab();
        expect((event as unknown as { preventSpy: { mock: { calls: unknown[] } } }).preventSpy.mock.calls).toHaveLength(0);
    });

    it('wraps backward from the first element to the last on Shift+Tab', () => {
        first.focus();
        expect(document.activeElement).toBe(first);
        const lastFocus = vi.spyOn(last, 'focus');
        const event = tab({ shiftKey: true });
        expect((event as unknown as { preventSpy: { mock: { calls: unknown[] } } }).preventSpy.mock.calls).toHaveLength(1);
        expect(lastFocus).toHaveBeenCalled();
    });

    it('does not wrap backward when focus is not on the first element', () => {
        last.focus();
        const event = tab({ shiftKey: true });
        expect((event as unknown as { preventSpy: { mock: { calls: unknown[] } } }).preventSpy.mock.calls).toHaveLength(0);
    });
});

@Component({
    template: `
        <ui-dialog>
            <ui-dialog-trigger><span class="inner">Open</span></ui-dialog-trigger>
        </ui-dialog>
    `,
    imports: [DialogComponent, DialogTriggerComponent],
})
class TriggerKeydownHost { }

describe('DialogTriggerComponent — keyboard activation', () => {
    let fixture: ComponentFixture<TriggerKeydownHost>;
    let dialog: DialogComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TriggerKeydownHost],
        }).compileComponents();
        fixture = TestBed.createComponent(TriggerKeydownHost);
        fixture.detectChanges();
        await fixture.whenStable();
        dialog = fixture.debugElement
            .query(By.directive(DialogComponent))
            .componentInstance as DialogComponent;
    });

    it('toggles open when Enter is pressed on the wrapper itself', () => {
        const wrapper = fixture.debugElement.query(By.css('[data-slot="dialog-trigger"]'))
            .nativeElement as HTMLElement;
        wrapper.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(dialog.open()).toBe(true);
    });

    it('does not toggle when the keydown originates from projected child content', () => {
        const inner = fixture.debugElement.query(By.css('.inner'))
            .nativeElement as HTMLElement;
        inner.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(dialog.open()).toBe(false);
    });
});
