import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PropertyEditorComponent } from './property-editor.component';
import { describe, it, expect, beforeEach } from 'vitest';

describe('PropertyEditorComponent', () => {
    let component: PropertyEditorComponent;
    let fixture: ComponentFixture<PropertyEditorComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PropertyEditorComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(PropertyEditorComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should default item to undefined', () => {
        expect(component.item()).toBeUndefined();
    });

    it('should default componentMeta to undefined', () => {
        expect(component.componentMeta()).toBeUndefined();
    });

    it('should default isLoading to false', () => {
        expect(component.isLoading()).toBe(false);
    });

    it('should show empty state when no item is selected', () => {
        const el = fixture.nativeElement as HTMLElement;
        expect(el.textContent).toContain('No Selection');
    });

    it('should return undefined for getItemInput when no item', () => {
        expect(component.getItemInput('title')).toBeUndefined();
    });

    it('should return false for hasBinding when no item', () => {
        expect(component.hasBinding('title')).toBe(false);
    });

    it('should return empty string for getBinding when no item', () => {
        expect(component.getBinding('title')).toBe('');
    });
});
