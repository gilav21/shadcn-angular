import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { DataTableColumnHeaderComponent } from './data-table-column-header.component';
import { SortDirection } from './data-table.types';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { By } from '@angular/platform-browser';

@Component({
    template: `
        <ui-data-table-column-header
            [title]="title()"
            [column]="column()"
            [direction]="direction()"
            [enableSorting]="enableSorting()"
            [sortIndex]="sortIndex()"
            (sort)="onSort($event)"
            (sortMeta)="onSortMeta($event)"
        />
    `,
    imports: [DataTableColumnHeaderComponent]
})
class TestHostComponent {
    title = signal('Name');
    column = signal('name');
    direction = signal<SortDirection>(null);
    enableSorting = signal(true);
    sortIndex = signal<number | null>(null);
    onSort = vi.fn();
    onSortMeta = vi.fn();
}

describe('DataTableColumnHeaderComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(fixture.componentInstance).toBeTruthy();
    });

    it('should render title', () => {
        const el = fixture.debugElement.query(By.css('span'));
        expect(el.nativeElement.textContent.trim()).toBe('Name');
    });

    it('should render a sort button when sorting is enabled', () => {
        const button = fixture.debugElement.query(By.css('ui-button'));
        expect(button).toBeTruthy();
    });

    it('should render plain text when sorting is disabled', async () => {
        host.enableSorting.set(false);
        fixture.detectChanges();
        await fixture.whenStable();

        const button = fixture.debugElement.query(By.css('ui-button'));
        expect(button).toBeFalsy();

        const textDiv = fixture.debugElement.query(By.css('div > div'));
        expect(textDiv.nativeElement.textContent.trim()).toBe('Name');
    });

    it('should emit sort event on click with asc when no direction set', () => {
        const button = fixture.debugElement.query(By.css('ui-button'));
        button.nativeElement.click();
        fixture.detectChanges();

        expect(host.onSort).toHaveBeenCalledWith('asc');
    });

    it('should emit sort desc when current direction is asc', async () => {
        host.direction.set('asc');
        fixture.detectChanges();
        await fixture.whenStable();

        const button = fixture.debugElement.query(By.css('ui-button'));
        button.nativeElement.click();
        fixture.detectChanges();

        expect(host.onSort).toHaveBeenCalledWith('desc');
    });

    it('should emit sort null when current direction is desc', async () => {
        host.direction.set('desc');
        fixture.detectChanges();
        await fixture.whenStable();

        const button = fixture.debugElement.query(By.css('ui-button'));
        button.nativeElement.click();
        fixture.detectChanges();

        expect(host.onSort).toHaveBeenCalledWith(null);
    });

    it('should show sort index badge when sortIndex is provided', async () => {
        host.sortIndex.set(0);
        fixture.detectChanges();
        await fixture.whenStable();

        const badge = fixture.nativeElement.querySelector('.rounded-full');
        expect(badge).toBeTruthy();
        expect(badge.textContent.trim()).toBe('1');
    });

    it('should not show sort index badge when sortIndex is null', () => {
        host.sortIndex.set(null);
        fixture.detectChanges();

        const badge = fixture.nativeElement.querySelector('.rounded-full');
        expect(badge).toBeFalsy();
    });

    it('should update title when input changes', async () => {
        host.title.set('Email');
        fixture.detectChanges();
        await fixture.whenStable();

        const el = fixture.debugElement.query(By.css('span'));
        expect(el.nativeElement.textContent.trim()).toBe('Email');
    });

    describe('full sort cycle', () => {
        it('should cycle through null -> asc -> desc -> null on repeated clicks', async () => {
            const button = fixture.debugElement.query(By.css('ui-button'));

            button.nativeElement.click();
            fixture.detectChanges();
            expect(host.onSort).toHaveBeenLastCalledWith('asc');

            host.direction.set('asc');
            fixture.detectChanges();
            await fixture.whenStable();

            button.nativeElement.click();
            fixture.detectChanges();
            expect(host.onSort).toHaveBeenLastCalledWith('desc');

            host.direction.set('desc');
            fixture.detectChanges();
            await fixture.whenStable();

            button.nativeElement.click();
            fixture.detectChanges();
            expect(host.onSort).toHaveBeenLastCalledWith(null);
        });

        it('should emit sortMeta with correct direction at each step of the cycle', async () => {
            const button = fixture.debugElement.query(By.css('ui-button'));

            button.nativeElement.click();
            fixture.detectChanges();
            expect(host.onSortMeta).toHaveBeenLastCalledWith({ direction: 'asc', multi: false });

            host.direction.set('asc');
            fixture.detectChanges();
            await fixture.whenStable();

            button.nativeElement.click();
            fixture.detectChanges();
            expect(host.onSortMeta).toHaveBeenLastCalledWith({ direction: 'desc', multi: false });

            host.direction.set('desc');
            fixture.detectChanges();
            await fixture.whenStable();

            button.nativeElement.click();
            fixture.detectChanges();
            expect(host.onSortMeta).toHaveBeenLastCalledWith({ direction: null, multi: false });
        });

        it('should have been called exactly 3 times after full cycle', async () => {
            host.onSort.mockClear();
            const button = fixture.debugElement.query(By.css('ui-button'));

            button.nativeElement.click();
            fixture.detectChanges();

            host.direction.set('asc');
            fixture.detectChanges();
            await fixture.whenStable();

            button.nativeElement.click();
            fixture.detectChanges();

            host.direction.set('desc');
            fixture.detectChanges();
            await fixture.whenStable();

            button.nativeElement.click();
            fixture.detectChanges();

            expect(host.onSort).toHaveBeenCalledTimes(3);
        });
    });

    describe('shift-click for multi-sort', () => {
        it('should emit sortMeta with multi=true when shift key is held', () => {
            const headerComponent = fixture.debugElement.query(By.directive(DataTableColumnHeaderComponent));
            const buttonEl = headerComponent.query(By.css('ui-button'));

            const shiftClickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                shiftKey: true,
            });
            buttonEl.nativeElement.dispatchEvent(shiftClickEvent);
            fixture.detectChanges();

            expect(host.onSortMeta).toHaveBeenCalledWith({ direction: 'asc', multi: true });
        });

        it('should emit sortMeta with multi=false when shift key is not held', () => {
            const button = fixture.debugElement.query(By.css('ui-button'));

            button.nativeElement.click();
            fixture.detectChanges();

            expect(host.onSortMeta).toHaveBeenCalledWith({ direction: 'asc', multi: false });
        });

        it('should emit multi=true through the full sort cycle with shift held', async () => {
            const headerComponent = fixture.debugElement.query(By.directive(DataTableColumnHeaderComponent));
            const buttonEl = headerComponent.query(By.css('ui-button'));

            const shiftClick = () => {
                const event = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    shiftKey: true,
                });
                buttonEl.nativeElement.dispatchEvent(event);
                fixture.detectChanges();
            };

            shiftClick();
            expect(host.onSortMeta).toHaveBeenLastCalledWith({ direction: 'asc', multi: true });

            host.direction.set('asc');
            fixture.detectChanges();
            await fixture.whenStable();

            shiftClick();
            expect(host.onSortMeta).toHaveBeenLastCalledWith({ direction: 'desc', multi: true });

            host.direction.set('desc');
            fixture.detectChanges();
            await fixture.whenStable();

            shiftClick();
            expect(host.onSortMeta).toHaveBeenLastCalledWith({ direction: null, multi: true });
        });
    });
});
