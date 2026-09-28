import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PopoverComponent } from './popover.component';
import { PopoverTriggerComponent } from './sub/popover-trigger.component';
import { PopoverContentComponent } from './sub/popover-content.component';
import { PopoverCloseComponent } from './sub/popover-close.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DialogComponent, DialogContentComponent } from '../dialog';

// Test host for integration
@Component({
    template: `
        <ui-popover (openChange)="onOpenChange($event)">
            <ui-popover-trigger>Open</ui-popover-trigger>
            <ui-popover-content>
                Popover content
                <ui-popover-close>Close</ui-popover-close>
            </ui-popover-content>
        </ui-popover>
    `,
    imports: [PopoverComponent, PopoverTriggerComponent, PopoverContentComponent, PopoverCloseComponent]
})
class TestHostComponent {
    isOpen = false;
    onOpenChange(open: boolean) {
        this.isOpen = open;
    }
}

describe('PopoverComponent', () => {
    let component: PopoverComponent;
    let fixture: ComponentFixture<PopoverComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PopoverComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(PopoverComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should toggle open state', () => {
        component.toggle();
        expect(component.open()).toBe(true);

        component.toggle();
        expect(component.open()).toBe(false);
    });

    it('closes on Escape', () => {
        // The component's own doc comment promised this ("closed internally on
        // an outside click, on Escape, and by ui-popover-close") but no handler
        // ever implemented it, so every popover in the library — colour picker,
        // font pickers, link, image, table — trapped the user until they
        // clicked elsewhere.
        component.show();
        fixture.detectChanges();
        expect(component.open()).toBe(true);

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        fixture.detectChanges();

        expect(component.open()).toBe(false);
    });

});

describe('Popover Integration', () => {
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

    it('should show content on trigger click', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="popover-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="popover-content"]'));
        expect(content).toBeTruthy();
        expect(content.nativeElement.dataset.state).toBe('open');
        expect(component.isOpen).toBe(true);
    });

    it('should close on close button click', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="popover-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const close = fixture.debugElement.query(By.css('[data-slot="popover-close"]'));
        close.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="popover-content"]'));
        expect(content).toBeNull();
    });

});

@Component({
    template: `
        <ui-popover>
            <ui-popover-trigger><button type="button" class="trigger-btn">Open</button></ui-popover-trigger>
            <ui-popover-content [restoreFocus]="restoreFocus()">
                <button type="button" class="inside">Inside</button>
                <ui-popover-close><button type="button" class="close-btn">Close</button></ui-popover-close>
            </ui-popover-content>
        </ui-popover>
        <button type="button" class="outside">Outside</button>
    `,
    imports: [PopoverComponent, PopoverTriggerComponent, PopoverContentComponent, PopoverCloseComponent]
})
class RestoreFocusHostComponent {
    readonly restoreFocus = signal(true);
}

describe('PopoverContent focus restoration', () => {
    let fixture: ComponentFixture<RestoreFocusHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RestoreFocusHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(RestoreFocusHostComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
    });

    function query(selector: string): HTMLElement {
        return fixture.nativeElement.querySelector(selector) as HTMLElement;
    }

    async function openAndFocusInside(): Promise<HTMLElement> {
        query('.trigger-btn').click();
        fixture.detectChanges();
        await fixture.whenStable();

        const inside = query('.inside');
        inside.focus();
        expect(document.activeElement).toBe(inside);
        return inside;
    }

    it('returns focus to the trigger when the content closes', async () => {
        await openAndFocusInside();

        query('.close-btn').click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(fixture.nativeElement.querySelector('[data-slot="popover-content"]')).toBeNull();
        expect(document.activeElement).toBe(query('.trigger-btn'));
    });

    it('leaves focus alone when restoreFocus is false', async () => {
        fixture.componentInstance.restoreFocus.set(false);
        fixture.detectChanges();

        await openAndFocusInside();

        query('.close-btn').click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(document.activeElement).not.toBe(query('.trigger-btn'));
    });

    it('does not steal focus the user has moved elsewhere', async () => {
        await openAndFocusInside();

        const outside = query('.outside');
        outside.focus();
        outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        await fixture.whenStable();

        expect(document.activeElement).toBe(outside);
    });
});

@Component({
    template: `
        <ui-popover [open]="open()">
            <ui-popover-trigger>Open</ui-popover-trigger>
            <ui-popover-content
                [strategy]="strategy()"
                [side]="side()"
                [align]="align()"
                [avoidCollisions]="avoidCollisions()"
            >Positioned content</ui-popover-content>
        </ui-popover>
    `,
    imports: [PopoverComponent, PopoverTriggerComponent, PopoverContentComponent],
})
class PositionHostComponent {
    open = signal(false);
    strategy = signal<'absolute' | 'fixed'>('absolute');
    side = signal<'top' | 'right' | 'bottom' | 'left'>('bottom');
    align = signal<'start' | 'center' | 'end'>('center');
    avoidCollisions = signal(true);
}

describe('PopoverContent positioning', () => {
    let fixture: ComponentFixture<PositionHostComponent>;
    let component: PositionHostComponent;

    beforeEach(async () => {
        // Guard against popover content leaked by an earlier spec file: these tests
        // query `[data-slot="popover-content"]` globally, so a stray node from another
        // file would be matched first and fail the positioning assertions.
        document.querySelectorAll('[data-popover-portal],[data-slot="popover-content"]').forEach((n) => n.remove());
        await TestBed.configureTestingModule({
            imports: [PositionHostComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(PositionHostComponent);
        component = fixture.componentInstance;
        // attach to live DOM so getBoundingClientRect returns real geometry
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.nativeElement.remove();
        document.querySelectorAll('[data-popover-portal]').forEach(n => n.remove());
    });

    function content(): PopoverContentComponent {
        return fixture.debugElement.query(By.directive(PopoverContentComponent)).componentInstance as PopoverContentComponent;
    }

    async function openPopover(): Promise<void> {
        component.open.set(true);
        fixture.detectChanges();
        await fixture.whenStable();
        // allow the requestAnimationFrame-driven portalAndPosition to run
        await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        fixture.detectChanges();
    }

    it('fixed strategy places content in the top layer (body portal fallback)', async () => {
        component.strategy.set('fixed');
        await openPopover();
        const el = document.querySelector('[data-slot="popover-content"]') as HTMLElement;
        expect(el).toBeTruthy();
        if (typeof (el as { showPopover?: unknown }).showPopover === 'function') {
            // Popover API path: promoted to the top layer, element stays in place (no portal host)
            expect(el.hasAttribute('popover')).toBe(true);
            expect(el.matches(':popover-open')).toBe(true);
        } else {
            // Fallback path (no Popover API): portaled to document.body
            const portal = document.querySelector('[data-popover-portal]');
            expect(portal).toBeTruthy();
            expect(portal!.contains(el)).toBe(true);
        }
        // fixed styles computed from trigger rect
        const styles = content().positionStyles();
        expect(styles).toContain('position:fixed');
        expect(styles).toContain('top:');
        expect(styles).toContain('left:');
    });

    it('fixed strategy with end align translates -100%', async () => {
        component.strategy.set('fixed');
        component.align.set('end');
        await openPopover();
        const styles = content().positionStyles();
        expect(styles).toContain('translateX(-100%)');
    });

    it('fixed strategy with start align uses no translate', async () => {
        component.strategy.set('fixed');
        component.align.set('start');
        await openPopover();
        const styles = content().positionStyles();
        expect(styles).not.toContain('translateX');
    });

    it('tears down fixed content when closed', async () => {
        component.strategy.set('fixed');
        await openPopover();
        expect(document.querySelector('[data-slot="popover-content"]')).toBeTruthy();
        component.open.set(false);
        fixture.detectChanges();
        await fixture.whenStable();
        // Content removed and no leftover body portal regardless of placement strategy.
        expect(document.querySelector('[data-slot="popover-content"]')).toBeNull();
        expect(document.querySelector('[data-popover-portal]')).toBeNull();
    });

    type Adjuster = {
        computeVerticalAdjustment(r: DOMRect, b: { top: number; bottom: number }): { side: string; offsetY: number };
        computeHorizontalOffset(r: DOMRect, b: { left: number; right: number }): number;
    };

    it('keeps the side and offsets up when the content overflows the bottom with no room above', async () => {
        await openPopover();
        const popover = fixture.debugElement.query(By.directive(PopoverComponent)).componentInstance as PopoverComponent;
        // 100px above the trigger cannot hold an 800px panel, so flipping to the top is not an option.
        vi.spyOn(popover, 'getTriggerRect').mockReturnValue(new DOMRect(100, 70, 60, 30));
        const tallRect = new DOMRect(100, 700, 200, 800);
        const adjust = (content() as unknown as Adjuster).computeVerticalAdjustment(tallRect, { top: 0, bottom: 800 });
        expect(adjust).toEqual({ side: 'bottom', offsetY: -708 });
    });

    it('shifts overflowing content back inside the boundary with an 8px margin', async () => {
        await openPopover();
        const c = content() as unknown as Adjuster;
        const boundary = { left: 0, right: 1000 };
        expect(c.computeHorizontalOffset({ left: 900, right: 1200 } as DOMRect, boundary)).toBe(-208);
        expect(c.computeHorizontalOffset({ left: -50, right: 100 } as DOMRect, boundary)).toBe(58);
        expect(c.computeHorizontalOffset({ left: 200, right: 500 } as DOMRect, boundary)).toBe(0);
    });
});

@Component({
    template: `
        <dialog #dlg>
            <ui-popover [open]="open()">
                <ui-popover-trigger>Open</ui-popover-trigger>
                <ui-popover-content strategy="fixed">In-dialog content</ui-popover-content>
            </ui-popover>
        </dialog>
    `,
    imports: [PopoverComponent, PopoverTriggerComponent, PopoverContentComponent],
})
class DialogHostComponent {
    open = signal(false);
}

describe('PopoverContent inside a modal dialog (top layer)', () => {
    let fixture: ComponentFixture<DialogHostComponent>;
    let component: DialogHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [DialogHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(DialogHostComponent);
        component = fixture.componentInstance;
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.nativeElement.remove();
        document.querySelectorAll('[data-popover-portal]').forEach(n => n.remove());
    });

    it('promotes the fixed popover to the top layer so it sits above the modal', async () => {
        const probe = document.createElement('div');
        // jsdom lacks showModal / the Popover API / :modal — this assertion is browser-only.
        if (typeof (probe as { showPopover?: unknown }).showPopover !== 'function') return;

        const dlg = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
        dlg.showModal();
        expect(dlg.matches(':modal')).toBe(true);

        component.open.set(true);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        fixture.detectChanges();

        const el = document.querySelector('[data-slot="popover-content"]') as HTMLElement;
        expect(el).toBeTruthy();
        // In the top layer the popover is open and renders above the modal dialog.
        expect(el.matches(':popover-open')).toBe(true);

        dlg.close();
    });

    it('retries the top layer instead of portaling when the content is not yet attached', async () => {
        const probe = document.createElement('div');
        if (typeof (probe as { showPopover?: unknown }).showPopover !== 'function') return;

        const dlg = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
        dlg.showModal();
        component.open.set(true);
        fixture.detectChanges();
        await fixture.whenStable();

        const contentCmp = fixture.debugElement
            .query(By.directive(PopoverContentComponent))
            .componentInstance as PopoverContentComponent;
        const internals = contentCmp as unknown as {
            placeContent(): boolean;
            usedPopoverApi: boolean;
            contentEl?: { nativeElement: HTMLElement };
        };
        const el = internals.contentEl?.nativeElement as HTMLElement;
        const parent = el.parentElement as HTMLElement;

        internals.usedPopoverApi = false;
        try {
            el.hidePopover();
        } catch {
            // Not in the top layer yet — nothing to hide.
        }
        el.removeAttribute('popover');
        el.remove();

        expect(internals.placeContent()).toBe(false);
        expect(document.querySelector('[data-popover-portal]')).toBeNull();

        parent.appendChild(el);

        expect(internals.placeContent()).toBe(true);
        expect(el.matches(':popover-open')).toBe(true);
        expect(document.querySelector('[data-popover-portal]')).toBeNull();

        dlg.close();
    });
});

describe('PopoverComponent - Escape inside a dialog (fine-comb review)', () => {
    @Component({
        template: `
            <ui-dialog [(open)]="dialogOpen">
                <ui-dialog-content>
                    <ui-popover>
                        <ui-popover-trigger>Open</ui-popover-trigger>
                        <ui-popover-content><button id="inner" type="button">inside</button></ui-popover-content>
                    </ui-popover>
                </ui-dialog-content>
            </ui-dialog>
        `,
        imports: [DialogComponent, DialogContentComponent, PopoverComponent, PopoverTriggerComponent, PopoverContentComponent],
    })
    class DialogHostComponent {
        dialogOpen = true;
    }

    afterEach(() => TestBed.resetTestingModule());

    it('closes only the popover; the dialog behind it stays open', () => {
        // The dialog panel closes on Escape from its own keydown handler and
        // the popover listened on the document. Without consuming the key in
        // capture, one press closed both layers.
        const fixture = TestBed.createComponent(DialogHostComponent);
        fixture.detectChanges();
        const popover = fixture.debugElement.query(By.directive(PopoverComponent)).componentInstance as PopoverComponent;
        popover.show();
        fixture.detectChanges();

        const inner = (fixture.nativeElement as HTMLElement).querySelector('#inner') as HTMLElement;
        expect(inner).toBeTruthy();
        inner.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        fixture.detectChanges();

        expect(popover.open()).toBe(false);
        expect(fixture.componentInstance.dialogOpen).toBe(true);
        expect((fixture.nativeElement as HTMLElement).querySelector('[data-slot="dialog-content"]')).toBeTruthy();
    });

    it('with the popover closed, Escape still reaches the dialog', () => {
        const fixture = TestBed.createComponent(DialogHostComponent);
        fixture.detectChanges();
        const panel = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="dialog-content"]') as HTMLElement;
        panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        fixture.detectChanges();
        expect(fixture.componentInstance.dialogOpen).toBe(false);
    });
});

describe('PopoverComponent - overlay layers (follow-up F2)', () => {
    @Component({
        template: `
            <ui-popover #outer>
                <ui-popover-trigger>Outer</ui-popover-trigger>
                <ui-popover-content>
                    <ui-popover #inner>
                        <ui-popover-trigger>Inner</ui-popover-trigger>
                        <ui-popover-content><button id="deep" type="button">deep</button></ui-popover-content>
                    </ui-popover>
                </ui-popover-content>
            </ui-popover>
        `,
        imports: [PopoverComponent, PopoverTriggerComponent, PopoverContentComponent],
    })
    class NestedHostComponent {}

    afterEach(() => TestBed.resetTestingModule());

    it('closes only the innermost of two open popovers per Escape', () => {
        const fixture = TestBed.createComponent(NestedHostComponent);
        fixture.detectChanges();
        const popovers = (): PopoverComponent[] => fixture.debugElement
            .queryAll(By.directive(PopoverComponent))
            .map((d) => d.componentInstance as PopoverComponent);
        const outer = popovers()[0];
        outer.show();
        fixture.detectChanges();
        // The inner popover lives in the outer's content, so it exists only now.
        const inner = popovers()[1];
        inner.show();
        fixture.detectChanges();

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        fixture.detectChanges();
        expect(inner.open()).toBe(false);
        expect(outer.open()).toBe(true);

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        fixture.detectChanges();
        expect(outer.open()).toBe(false);
    });
});
