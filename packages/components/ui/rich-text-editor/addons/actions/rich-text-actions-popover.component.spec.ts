import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { RichTextActionsPopoverComponent } from './rich-text-actions-popover.component';

describe('RichTextActionsPopoverComponent', () => {
    it('lists actions and emits edit/remove per row', () => {
        const fixture = TestBed.createComponent(RichTextActionsPopoverComponent);
        fixture.componentRef.setInput('actions', [
            { trigger: 'click', id: 'open-dialog', label: 'Open dialog', available: true },
            { trigger: 'hover', id: 'ghost', label: 'ghost', available: false },
        ]);
        fixture.detectChanges();
        const edits: string[] = [];
        const removes: string[] = [];
        fixture.componentInstance.edit.subscribe((t: string) => edits.push(t));
        fixture.componentInstance.remove.subscribe((t: string) => removes.push(t));
        const editBtns = fixture.nativeElement.querySelectorAll('[data-testid="rta-edit"]');
        expect(editBtns).toHaveLength(1);
        (editBtns[0] as HTMLButtonElement).click();
        expect(edits).toEqual(['click']);
        const removeBtns = fixture.nativeElement.querySelectorAll('[data-testid="rta-remove"]');
        expect(removeBtns).toHaveLength(2);
        (removeBtns[1] as HTMLButtonElement).click();
        expect(removes).toEqual(['hover']);
    });

    it('emits add when the add button is clicked', () => {
        const fixture = TestBed.createComponent(RichTextActionsPopoverComponent);
        fixture.componentRef.setInput('actions', []);
        fixture.detectChanges();
        let added = false;
        fixture.componentInstance.add.subscribe(() => (added = true));
        (fixture.nativeElement.querySelector('[data-testid="rta-add"]') as HTMLButtonElement).click();
        expect(added).toBe(true);
    });
});
