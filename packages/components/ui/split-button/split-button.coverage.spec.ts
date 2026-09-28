import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { SplitButtonComponent } from './split-button.component';
import { SplitButtonPrimaryComponent } from './sub/split-button-primary.component';
import { SplitButtonMenuComponent } from './sub/split-button-menu.component';
import { SplitButtonItemComponent } from './sub/split-button-item.component';
import { ButtonComponent } from '../button';
import {
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
    vi,
} from 'vitest';

@Component({
    template: `
    <ui-split-button>
      <ui-split-button-primary>Primary</ui-split-button-primary>
      <ui-split-button-menu>
        <ui-split-button-item [value]="'a'">Enabled</ui-split-button-item>
        <ui-split-button-item [disabled]="true">Disabled</ui-split-button-item>
      </ui-split-button-menu>
    </ui-split-button>
  `,
    imports: [
        SplitButtonComponent,
        SplitButtonPrimaryComponent,
        SplitButtonMenuComponent,
        SplitButtonItemComponent,
    ],
    standalone: true,
})
class ProjectionHostComponent {}

describe('SplitButtonComponent — coverage', () => {
    /** Whether THIS suite added the Popover API, so teardown removes only that. */
    let addedPopoverApi = false;
    let fixture: ComponentFixture<SplitButtonComponent>;
    let component: SplitButtonComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SplitButtonComponent, ButtonComponent, ProjectionHostComponent],
        }).compileComponents();

        // Fill the Popover API in only when the engine lacks it, and take back
        // exactly what we added.
        //
        // This used to overwrite `HTMLElement.prototype.showPopover` with a
        // no-op on every run and never restore it. That prototype is shared with
        // every other spec file — this browser suite gives no file its own realm
        // — so from the first test here onwards, any suite that promoted an
        // element to the top layer silently got nothing and failed on an
        // assertion unrelated to its own code. It was the last source of the
        // intermittent `:popover-open` failures across the suite.
        addedPopoverApi = !('showPopover' in HTMLElement.prototype);
        if (addedPopoverApi) {
            Object.defineProperty(HTMLElement.prototype, 'showPopover', {
                configurable: true,
                value: () => {},
            });
            Object.defineProperty(HTMLElement.prototype, 'hidePopover', {
                configurable: true,
                value: () => {},
            });
        }

        fixture = TestBed.createComponent(SplitButtonComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('label', 'Save');
        fixture.componentRef.setInput('items', [
            { label: 'Edit', value: 'edit' },
            { label: 'Delete', value: 'delete', disabled: true },
        ]);
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        if (addedPopoverApi) {
            delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover;
            delete (HTMLElement.prototype as Partial<HTMLElement>).hidePopover;
            addedPopoverApi = false;
        }
    });

    it('closes the menu on a document click outside the component, keeps it open for one inside, and stops listening once destroyed', () => {
        component.isOpen.set(true);
        fixture.detectChanges();

        const inside = fixture.nativeElement.querySelector('[data-slot="split-button"]');
        inside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(component.isOpen()).toBe(true);

        component['document'].dispatchEvent(
            new MouseEvent('click', { bubbles: true }),
        );
        expect(component.isOpen()).toBe(false);

        component.isOpen.set(true);
        fixture.detectChanges();
        fixture.destroy();
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(component.isOpen()).toBe(true);
    });

    it('does not act on a disabled item passed to onItemClick', () => {
        const spy = vi.spyOn(component.itemClick, 'emit');
        component.isOpen.set(true);

        component.onItemClick(
            { label: 'Delete', disabled: true },
            new MouseEvent('click'),
        );

        expect(spy).not.toHaveBeenCalled();
        expect(component.isOpen()).toBe(true);
    });

    it('opens the menu and focuses the first item on dropdown Enter/Space/ArrowDown, ignoring other keys', () => {
        component.onDropdownKeydown({
            key: 'a',
            preventDefault: () => {},
        } as unknown as KeyboardEvent);
        expect(component.isOpen()).toBe(false);

        vi.useFakeTimers();
        try {
            for (const key of ['Enter', ' ', 'ArrowDown']) {
                component.isOpen.set(false);
                fixture.detectChanges();

                const preventDefault = vi.fn();
                component.onDropdownKeydown({
                    key,
                    preventDefault,
                } as unknown as KeyboardEvent);

                expect(preventDefault).toHaveBeenCalled();
                expect(component.isOpen()).toBe(true);

                fixture.detectChanges();
                const firstItem = fixture.nativeElement.querySelector(
                    '[role="menuitem"]',
                ) as HTMLElement;
                const focusSpy = vi.spyOn(firstItem, 'focus');
                vi.runAllTimers();
                expect(focusSpy).toHaveBeenCalled();
            }
        } finally {
            vi.useRealTimers();
        }
    });

    it('wraps ArrowUp from the first item to the last', () => {
        fixture.componentRef.setInput('items', [
            { label: '1' },
            { label: '2' },
            { label: '3' },
        ]);
        component.isOpen.set(true);
        fixture.detectChanges();

        const items = fixture.debugElement.queryAll(By.css('[role="menuitem"]'));
        items[0].nativeElement.focus();

        const menu = fixture.debugElement.query(By.css('[role="menu"]'));
        menu.triggerEventHandler('keydown', {
            key: 'ArrowUp',
            preventDefault: () => {},
        });

        expect(document.activeElement).toBe(items[2].nativeElement);

        menu.triggerEventHandler('keydown', {
            key: 'x',
            preventDefault: () => {},
        });
        expect(component.isOpen()).toBe(true);
    });

    describe('projected sub-components', () => {
        let host: ComponentFixture<ProjectionHostComponent>;

        beforeEach(() => {
            host = TestBed.createComponent(ProjectionHostComponent);
            host.detectChanges();
        });

        it('projected primary emits primaryClick, an enabled item emits itemClick and closes, and a disabled item does nothing', () => {
            const split = host.debugElement.query(
                By.directive(SplitButtonComponent),
            ).componentInstance as SplitButtonComponent;
            const primarySpy = vi.spyOn(split.primaryClick, 'emit');
            const itemSpy = vi.spyOn(split.itemClick, 'emit');

            host.debugElement.query(By.css('ui-split-button-primary button')).nativeElement.click();
            expect(primarySpy).toHaveBeenCalled();

            split.isOpen.set(true);
            host.detectChanges();
            host.debugElement.query(By.css('ui-split-button-item button')).nativeElement.click();
            expect(itemSpy).toHaveBeenCalledWith({ label: '', value: 'a' });
            expect(split.isOpen()).toBe(false);

            itemSpy.mockClear();
            split.isOpen.set(true);
            host.detectChanges();
            const disabledItem = host.debugElement.queryAll(
                By.directive(SplitButtonItemComponent),
            )[1].componentInstance as SplitButtonItemComponent;
            disabledItem.onClick(new MouseEvent('click'));
            expect(itemSpy).not.toHaveBeenCalled();
            expect(split.isOpen()).toBe(true);
        });
    });
});
