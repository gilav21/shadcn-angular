import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { RichTextActionsFormComponent } from './rich-text-actions-form.component';

describe('RichTextActionsFormComponent', () => {
    it('emits invalid until a required field is filled, then valid', () => {
        const fixture = TestBed.createComponent(RichTextActionsFormComponent);
        const ref = fixture.componentRef;
        ref.setInput('fields', [{ key: 'dialogId', label: 'Dialog', type: 'text', required: true }]);
        ref.setInput('params', {});
        let valid = true;
        fixture.componentInstance.validChange.subscribe((v: boolean) => (valid = v));
        fixture.detectChanges();
        expect(valid).toBe(false);
        const input = fixture.nativeElement.querySelector('input[data-field="dialogId"]') as HTMLInputElement;
        input.value = 'pricing';
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();
        expect(valid).toBe(true);
    });

    it('emits params changes with correct value types', () => {
        const fixture = TestBed.createComponent(RichTextActionsFormComponent);
        const ref = fixture.componentRef;
        ref.setInput('fields', [{ key: 'count', label: 'Count', type: 'number' }]);
        ref.setInput('params', {});
        let latest: Record<string, unknown> = {};
        fixture.componentInstance.paramsChange.subscribe((p: Record<string, unknown>) => (latest = p));
        fixture.detectChanges();
        const input = fixture.nativeElement.querySelector('input[data-field="count"]') as HTMLInputElement;
        input.value = '42';
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();
        expect(latest['count']).toBe(42);
    });

    it('shows a custom validate() error message', () => {
        const fixture = TestBed.createComponent(RichTextActionsFormComponent);
        const ref = fixture.componentRef;
        ref.setInput('fields', [{
            key: 'code', label: 'Code', type: 'text',
            validate: (v: unknown) => (String(v).length < 3 ? 'Too short' : null),
        }]);
        ref.setInput('params', { code: 'ab' });
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('Too short');
    });
});
