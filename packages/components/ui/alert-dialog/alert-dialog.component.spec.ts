import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    AlertDialogComponent,
    AlertDialogTriggerComponent,
    AlertDialogContentComponent,
    AlertDialogHeaderComponent,
    AlertDialogFooterComponent,
    AlertDialogTitleComponent,
    AlertDialogDescriptionComponent,
    AlertDialogActionComponent,
    AlertDialogCancelComponent
} from './index';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Basic test host
@Component({
    template: `
        <ui-alert-dialog>
            <ui-alert-dialog-trigger>Open Alert</ui-alert-dialog-trigger>
            <ui-alert-dialog-content>
                <ui-alert-dialog-header>
                    <ui-alert-dialog-title>Are you absolutely sure?</ui-alert-dialog-title>
                    <ui-alert-dialog-description>
                        This action cannot be undone.
                    </ui-alert-dialog-description>
                </ui-alert-dialog-header>
                <ui-alert-dialog-footer>
                    <ui-alert-dialog-cancel>Cancel</ui-alert-dialog-cancel>
                    <ui-alert-dialog-action>Continue</ui-alert-dialog-action>
                </ui-alert-dialog-footer>
            </ui-alert-dialog-content>
        </ui-alert-dialog>
    `,
    imports: [
        AlertDialogComponent,
        AlertDialogTriggerComponent,
        AlertDialogContentComponent,
        AlertDialogHeaderComponent,
        AlertDialogFooterComponent,
        AlertDialogTitleComponent,
        AlertDialogDescriptionComponent,
        AlertDialogActionComponent,
        AlertDialogCancelComponent
    ]
})
class TestHostComponent { }

describe('AlertDialogComponent', () => {
    let component: AlertDialogComponent;
    let fixture: ComponentFixture<AlertDialogComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AlertDialogComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(AlertDialogComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should open and close', () => {
        component.show();
        expect(component.open()).toBe(true);

        component.hide();
        expect(component.open()).toBe(false);
    });

    it('should toggle', () => {
        component.toggle();
        expect(component.open()).toBe(true);

        component.toggle();
        expect(component.open()).toBe(false);
    });
});

describe('AlertDialog Integration', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('should not render content initially', () => {
        const content = document.querySelector('[data-slot="alert-dialog-content"]');
        expect(content).toBeNull();
    });

    it('should render title and description', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="alert-dialog-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const title = document.querySelector('[data-slot="alert-dialog-title"]')!;
        const desc = document.querySelector('[data-slot="alert-dialog-description"]')!;
        const content = document.querySelector('[data-slot="alert-dialog-content"]')!;

        expect(title.textContent?.trim()).toBe('Are you absolutely sure?');
        expect(desc.textContent?.trim()).toBe('This action cannot be undone.');
        expect(title.id).toBeTruthy();
        expect(content.getAttribute('aria-labelledby')).toBe(title.id);
    });

    it('should close on cancel click', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="alert-dialog-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const cancel = document.querySelector<HTMLElement>('[data-slot="alert-dialog-cancel"]');
        cancel!.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = document.querySelector('[data-slot="alert-dialog-content"]');
        expect(content).toBeNull();
    });

    it('should close on action click', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="alert-dialog-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const action = document.querySelector<HTMLElement>('[data-slot="alert-dialog-action"]');
        action!.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = document.querySelector('[data-slot="alert-dialog-content"]');
        expect(content).toBeNull();
    });

    it('should NOT close on overlay click (unlike regular Dialog)', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="alert-dialog-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = document.querySelector<HTMLElement>('[data-slot="alert-dialog-content"]')!;
        const overlay = content.parentElement!.firstElementChild as HTMLElement;
        expect(overlay).not.toBe(content);
        overlay.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(document.querySelector('[data-slot="alert-dialog-content"]')).toBeTruthy();
    });
});

// Simple mode test host
@Component({
    template: `
        <ui-alert-dialog>
            <ui-alert-dialog-trigger>Delete</ui-alert-dialog-trigger>
            <ui-alert-dialog-content
                title="Are you sure?"
                description="This cannot be undone."
                actionText="Delete"
                cancelText="Keep"
                (cancelClick)="events.push('cancel')"
                (actionClick)="events.push('action')"
            />
        </ui-alert-dialog>
    `,
    imports: [AlertDialogComponent, AlertDialogTriggerComponent, AlertDialogContentComponent]
})
class SimpleModeTestHostComponent {
    readonly events: string[] = [];
}

describe('AlertDialog Simple Mode', () => {
    let fixture: ComponentFixture<SimpleModeTestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SimpleModeTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SimpleModeTestHostComponent);
        fixture.detectChanges();
    });

    it('should auto-render title from input', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="alert-dialog-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const title = document.querySelector('[data-slot="alert-dialog-title"]');
        expect(title).toBeTruthy();
        expect(title?.textContent).toContain('Are you sure?');
    });

    it('should auto-render description from input', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="alert-dialog-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const desc = document.querySelector('[data-slot="alert-dialog-description"]');
        expect(desc).toBeTruthy();
        expect(desc?.textContent).toContain('This cannot be undone.');
    });

    it('emits cancelClick and actionClick from the auto-rendered buttons', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="alert-dialog-trigger"]'));
        const clickIn = async (slot: string): Promise<void> => {
            trigger.nativeElement.click();
            fixture.detectChanges();
            await fixture.whenStable();
            document.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!.click();
            fixture.detectChanges();
            await fixture.whenStable();
        };

        await clickIn('alert-dialog-cancel');
        expect(fixture.componentInstance.events).toEqual(['cancel']);

        await clickIn('alert-dialog-action');
        expect(fixture.componentInstance.events).toEqual(['cancel', 'action']);
        expect(document.querySelector('[data-slot="alert-dialog-content"]')).toBeNull();
    });
});

describe('AlertDialogContentComponent — i18n integration', () => {
    @Component({
        template: `
            <ui-alert-dialog>
                <ui-alert-dialog-content title="T" [locale]="locale" [actionText]="actionText" [cancelText]="cancelText" />
            </ui-alert-dialog>
        `,
        imports: [AlertDialogComponent, AlertDialogContentComponent],
    })
    class AlertI18nHost {
        locale: string | undefined = undefined;
        actionText: string | undefined = undefined;
        cancelText: string | undefined = undefined;
    }

    async function setup(opts: { locale?: string; actionText?: string; cancelText?: string; providerLocale?: string } = {}) {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [AlertI18nHost],
            providers: opts.providerLocale ? [provideUiLocale(opts.providerLocale)] : [],
        }).compileComponents();
        const fixture = TestBed.createComponent(AlertI18nHost);
        Object.assign(fixture.componentInstance, opts);
        fixture.detectChanges();
        const alertDialog = fixture.debugElement.query(By.directive(AlertDialogComponent)).componentInstance as AlertDialogComponent;
        alertDialog.show();
        fixture.detectChanges();
        await fixture.whenStable();
        return fixture;
    }

    it('defaults action/cancel to English "Continue" / "Cancel"', async () => {
        await setup();
        const action = document.querySelector<HTMLElement>('[data-slot="alert-dialog-action"]');
        const cancel = document.querySelector<HTMLElement>('[data-slot="alert-dialog-cancel"]');
        expect(action!.textContent.trim()).toBe('Continue');
        expect(cancel!.textContent.trim()).toBe('Cancel');
    });

    it('localises both buttons when locale="he"', async () => {
        await setup({ locale: 'he' });
        const action = document.querySelector<HTMLElement>('[data-slot="alert-dialog-action"]');
        const cancel = document.querySelector<HTMLElement>('[data-slot="alert-dialog-cancel"]');
        expect(action!.textContent.trim()).toBe('המשך');
        expect(cancel!.textContent.trim()).toBe('ביטול');
    });

    it('explicit actionText/cancelText inputs win over the locale', async () => {
        await setup({ locale: 'he', actionText: 'Save', cancelText: 'Discard' });
        const action = document.querySelector<HTMLElement>('[data-slot="alert-dialog-action"]');
        const cancel = document.querySelector<HTMLElement>('[data-slot="alert-dialog-cancel"]');
        expect(action!.textContent.trim()).toBe('Save');
        expect(cancel!.textContent.trim()).toBe('Discard');
    });

    it('falls back to UI_LOCALE_ID when no locale input is set', async () => {
        await setup({ providerLocale: 'fr' });
        const action = document.querySelector<HTMLElement>('[data-slot="alert-dialog-action"]');
        const cancel = document.querySelector<HTMLElement>('[data-slot="alert-dialog-cancel"]');
        expect(action!.textContent.trim()).toBe('Continuer');
        expect(cancel!.textContent.trim()).toBe('Annuler');
    });
});

// Host that projects non-interactive content (no title, no buttons)
@Component({
    template: `
        <ui-alert-dialog>
            <ui-alert-dialog-trigger>Open</ui-alert-dialog-trigger>
            <ui-alert-dialog-content>
                <div>Plain content without any focusable elements</div>
            </ui-alert-dialog-content>
        </ui-alert-dialog>
    `,
    imports: [AlertDialogComponent, AlertDialogTriggerComponent, AlertDialogContentComponent],
})
class NoFocusableHostComponent { }

// Host that is open on initial render (exercises ngAfterViewInit while open)
@Component({
    template: `
        <ui-alert-dialog [open]="true">
            <ui-alert-dialog-content title="Open at init" description="Desc" />
        </ui-alert-dialog>
    `,
    imports: [AlertDialogComponent, AlertDialogContentComponent],
})
class OpenAtInitHostComponent { }

function openViaTriggerWithTimers(fixture: ComponentFixture<unknown>): void {
    vi.useFakeTimers();
    const trigger = fixture.debugElement.query(By.css('[data-slot="alert-dialog-trigger"]'));
    trigger.nativeElement.click();
    fixture.detectChanges();
    vi.runAllTimers();
    fixture.detectChanges();
}

describe('AlertDialogContent — focus trap & keyboard', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function container(): HTMLElement {
        const content = document.querySelector('[data-slot="alert-dialog-content"]')!;
        return content.parentElement as HTMLElement;
    }

    it('closes on Escape key', () => {
        openViaTriggerWithTimers(fixture);
        expect(document.querySelector('[data-slot="alert-dialog-content"]')).toBeTruthy();

        const evt = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        const prevented = vi.spyOn(evt, 'preventDefault');
        container().dispatchEvent(evt);
        vi.useRealTimers();
        fixture.detectChanges();

        expect(prevented).toHaveBeenCalled();
        expect(document.querySelector('[data-slot="alert-dialog-content"]')).toBeNull();
    });

    it('wraps focus from first to last on Shift+Tab', () => {
        openViaTriggerWithTimers(fixture);
        const cancel = document.querySelector<HTMLElement>('[data-slot="alert-dialog-cancel"]')!;
        const action = document.querySelector<HTMLElement>('[data-slot="alert-dialog-action"]')!;
        cancel.focus();
        expect(document.activeElement).toBe(cancel);

        container().dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
        expect(document.activeElement).toBe(action);
    });

    it('wraps focus from last to first on Tab', () => {
        openViaTriggerWithTimers(fixture);
        const cancel = document.querySelector<HTMLElement>('[data-slot="alert-dialog-cancel"]')!;
        const action = document.querySelector<HTMLElement>('[data-slot="alert-dialog-action"]')!;
        action.focus();
        expect(document.activeElement).toBe(action);

        container().dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(document.activeElement).toBe(cancel);
    });

    it('does not trap when focus is mid-list', () => {
        openViaTriggerWithTimers(fixture);
        const action = document.querySelector<HTMLElement>('[data-slot="alert-dialog-action"]')!;
        action.focus();

        const shiftEvt = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
        const shiftPrevent = vi.spyOn(shiftEvt, 'preventDefault');
        container().dispatchEvent(shiftEvt);
        expect(shiftPrevent).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(action);

        const cancel = document.querySelector<HTMLElement>('[data-slot="alert-dialog-cancel"]')!;
        cancel.focus();
        const tabEvt = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
        const tabPrevent = vi.spyOn(tabEvt, 'preventDefault');
        container().dispatchEvent(tabEvt);
        expect(tabPrevent).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(cancel);
    });

    it('ignores non-handled keys', () => {
        openViaTriggerWithTimers(fixture);
        const evt = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
        const prevented = vi.spyOn(evt, 'preventDefault');
        container().dispatchEvent(evt);
        expect(prevented).not.toHaveBeenCalled();
        expect(document.querySelector('[data-slot="alert-dialog-content"]')).toBeTruthy();
    });
});

describe('AlertDialogContent — no focusable content', () => {
    let fixture: ComponentFixture<NoFocusableHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [NoFocusableHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(NoFocusableHostComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('focuses the content element itself and skips title id assignment', () => {
        openViaTriggerWithTimers(fixture);
        const content = document.querySelector<HTMLElement>('[data-slot="alert-dialog-content"]')!;
        expect(content).toBeTruthy();
        expect(content.getAttribute('aria-labelledby')).toBeNull();
        expect(document.querySelector('[data-slot="alert-dialog-title"]')).toBeNull();
        expect(document.activeElement).toBe(content);
    });
});

describe('AlertDialogContent — open on initial render', () => {
    it('focuses on ngAfterViewInit when already open', async () => {
        await TestBed.configureTestingModule({ imports: [OpenAtInitHostComponent] }).compileComponents();
        const fixture = TestBed.createComponent(OpenAtInitHostComponent);
        fixture.detectChanges();

        // Synchronous: the effect's setTimeout focus has not run yet, so only ngAfterViewInit can have focused.
        const content = document.querySelector('[data-slot="alert-dialog-content"]')!;
        expect(document.activeElement).toBe(content.querySelector('[data-slot="alert-dialog-cancel"]'));
    });
});

describe('AlertDialogContent — restores focus on close', () => {
    it('returns focus to the previously active element', async () => {
        await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
        const fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();

        const opener = document.createElement('button');
        document.body.appendChild(opener);
        opener.focus();
        const restoreSpy = vi.spyOn(opener, 'focus');

        const alertDialog = fixture.debugElement.query(By.directive(AlertDialogComponent)).componentInstance as AlertDialogComponent;
        alertDialog.show();
        fixture.detectChanges();
        await fixture.whenStable();

        alertDialog.hide();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(restoreSpy).toHaveBeenCalled();
        opener.remove();
    });
});

describe('AlertDialogTrigger — keyboard activation', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('toggles open on Enter when the event targets the trigger itself', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="alert-dialog-trigger"]'));
        trigger.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        fixture.detectChanges();
        expect(document.querySelector('[data-slot="alert-dialog-content"]')).toBeTruthy();
    });

    it('does nothing when the keydown originates from a nested element', async () => {
        const nestedFixture = TestBed.createComponent(NestedTriggerHostComponent);
        nestedFixture.detectChanges();
        await nestedFixture.whenStable();

        const nested = nestedFixture.nativeElement.querySelector('b') as HTMLElement;
        nested.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        nestedFixture.detectChanges();

        expect(nestedFixture.nativeElement.querySelector('[data-slot="alert-dialog-content"]')).toBeNull();
    });
});

@Component({
    template: `
        <ui-alert-dialog>
            <ui-alert-dialog-trigger><span>Open <b>now</b></span></ui-alert-dialog-trigger>
            <ui-alert-dialog-content title="Nested" />
        </ui-alert-dialog>
    `,
    imports: [AlertDialogComponent, AlertDialogTriggerComponent, AlertDialogContentComponent],
})
class NestedTriggerHostComponent { }
