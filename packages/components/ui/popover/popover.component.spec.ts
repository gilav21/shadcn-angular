import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PopoverComponent } from './popover.component';
import { PopoverTriggerComponent } from './sub/popover-trigger.component';
import { PopoverContentComponent } from './sub/popover-content.component';
import { PopoverCloseComponent } from './sub/popover-close.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

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

// RTL Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-popover>
                <ui-popover-trigger>فتح</ui-popover-trigger>
                <ui-popover-content>محتوى النافذة</ui-popover-content>
            </ui-popover>
        </div>
    `,
    imports: [PopoverComponent, PopoverTriggerComponent, PopoverContentComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
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

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should be closed by default', () => {
        expect(component.open()).toBe(false);
    });

    it('should toggle open state', () => {
        component.toggle();
        expect(component.open()).toBe(true);

        component.toggle();
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

    it('should render trigger', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="popover-trigger"]'));
        expect(trigger).toBeTruthy();
    });

    it('should not show content when closed', () => {
        const content = fixture.debugElement.query(By.css('[data-slot="popover-content"]'));
        expect(content).toBeNull();
    });

    it('should show content on trigger click', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="popover-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="popover-content"]'));
        expect(content).toBeTruthy();
    });

    it('should emit openChange on open', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="popover-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.isOpen).toBe(true);
    });

    it('should have data-state attribute', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="popover-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="popover-content"]'));
        expect(content.nativeElement.dataset.state).toBe('open');
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

    it('renders absolute content with side/align classes', async () => {
        await openPopover();
        const el = document.querySelector('[data-slot="popover-content"]') as HTMLElement;
        expect(el).toBeTruthy();
        expect(el.className).toContain('top-full');   // bottom side
        expect(el.className).toContain('-translate-x-1/2'); // center align
        expect(el.className).toContain('absolute');
    });

    it('applies start align class', async () => {
        component.align.set('start');
        await openPopover();
        const el = document.querySelector('[data-slot="popover-content"]') as HTMLElement;
        expect(el.className).toContain('left-0');
    });

    it('applies end align class', async () => {
        component.align.set('end');
        await openPopover();
        const el = document.querySelector('[data-slot="popover-content"]') as HTMLElement;
        expect(el.className).toContain('right-0');
    });

    it('applies top side class (collisions disabled keeps raw side)', async () => {
        component.side.set('top');
        component.avoidCollisions.set(false);
        await openPopover();
        const el = document.querySelector('[data-slot="popover-content"]') as HTMLElement;
        expect(el.className).toContain('bottom-full');
    });

    it('applies left/right side classes without align when side is horizontal', async () => {
        component.side.set('right');
        await openPopover();
        const el = document.querySelector('[data-slot="popover-content"]') as HTMLElement;
        expect(el.className).toContain('left-full');
    });

    it('skips collision adjustment when avoidCollisions is false', async () => {
        component.avoidCollisions.set(false);
        await openPopover();
        const pos = content()['adjustedPosition']();
        expect(pos.offsetX).toBe(0);
        expect(pos.offsetY).toBe(0);
    });

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

    it('flips side and offsets when content overflows the boundary', async () => {
        await openPopover();
        const c = content();
        // Simulate a content rect overflowing the bottom boundary, forcing a flip
        const tallRect = {
            top: 700, bottom: 1500, left: 100, right: 300, width: 200, height: 800,
            x: 100, y: 700, toJSON() { return this; },
        } as DOMRect;
        const boundary = { top: 0, bottom: 800, left: 0, right: 1000 };
        const adjust = (c as unknown as {
            computeVerticalAdjustment(r: DOMRect, b: { top: number; bottom: number }): { side: string; offsetY: number };
        }).computeVerticalAdjustment(tallRect, boundary);
        // overflowBottom > 0, current side bottom → either flips to top (if room) or offsets up
        expect(['top', 'bottom']).toContain(adjust.side);
        if (adjust.side === 'bottom') {
            expect(adjust.offsetY).toBeLessThan(0);
        }
    });

    it('computes a horizontal offset when content overflows right', async () => {
        await openPopover();
        const c = content();
        const rect = { right: 1200, left: 900 } as DOMRect;
        const offset = (c as unknown as {
            computeHorizontalOffset(r: DOMRect, b: { left: number; right: number }): number;
        }).computeHorizontalOffset(rect, { left: 0, right: 1000 });
        expect(offset).toBeLessThan(0);
        const offsetLeft = (c as unknown as {
            computeHorizontalOffset(r: DOMRect, b: { left: number; right: number }): number;
        }).computeHorizontalOffset({ right: 100, left: -50 } as DOMRect, { left: 0, right: 1000 });
        expect(offsetLeft).toBeGreaterThan(0);
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

describe('Popover RTL Support', () => {
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

    it('should open popover in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const trigger = fixture.debugElement.query(By.css('[data-slot="popover-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="popover-content"]'));
        expect(content).toBeTruthy();
    });
});
