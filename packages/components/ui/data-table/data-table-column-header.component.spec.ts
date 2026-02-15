import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { DataTableColumnHeaderComponent } from './data-table-column-header.component';
import { SortDirection } from './data-table.types';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { By } from '@angular/platform-browser';

@Component({
    template: `
        <ui-data-table-column-header
            [title]="title"
            [column]="column"
            [direction]="direction"
            [enableSorting]="enableSorting"
            [sortIndex]="sortIndex"
            (sort)="onSort($event)"
            (sortMeta)="onSortMeta($event)"
        />
    `,
    imports: [DataTableColumnHeaderComponent]
})
class TestHostComponent {
    title = 'Name';
    column = 'name';
    direction: SortDirection = null;
    enableSorting = true;
    sortIndex: number | null = null;
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

    it('should render plain text when sorting is disabled', () => {
        host.enableSorting = false;
        fixture.detectChanges();

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

    it('should emit sort desc when current direction is asc', () => {
        host.direction = 'asc';
        fixture.detectChanges();

        const button = fixture.debugElement.query(By.css('ui-button'));
        button.nativeElement.click();
        fixture.detectChanges();

        expect(host.onSort).toHaveBeenCalledWith('desc');
    });

    it('should emit sort null when current direction is desc', () => {
        host.direction = 'desc';
        fixture.detectChanges();

        const button = fixture.debugElement.query(By.css('ui-button'));
        button.nativeElement.click();
        fixture.detectChanges();

        expect(host.onSort).toHaveBeenCalledWith(null);
    });

    it('should show sort index badge when sortIndex is provided', () => {
        host.sortIndex = 0;
        fixture.detectChanges();

        const badge = fixture.nativeElement.querySelector('.rounded-full');
        expect(badge).toBeTruthy();
        expect(badge.textContent.trim()).toBe('1');
    });

    it('should not show sort index badge when sortIndex is null', () => {
        host.sortIndex = null;
        fixture.detectChanges();

        const badge = fixture.nativeElement.querySelector('.rounded-full');
        expect(badge).toBeFalsy();
    });

    it('should update title when input changes', () => {
        host.title = 'Email';
        fixture.detectChanges();

        const el = fixture.debugElement.query(By.css('span'));
        expect(el.nativeElement.textContent.trim()).toBe('Email');
    });
});
