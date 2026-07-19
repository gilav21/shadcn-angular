import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach } from 'vitest';
import { RichTextEditorComponent } from '../..';
import { EmojiPickerComponent } from '../../../emoji-picker';
import { RichTextEmojiDirective } from './rich-text-emoji.directive';

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextEmojiDirective],
    template: `<ui-rich-text-editor mode="html" [disabled]="disabled()" uiRteEmoji
        [uiRteEmojiLocale]="locale()" [uiRteEmojiOrder]="order()"
        (emojiInsert)="inserted.push($event)"></ui-rich-text-editor>`,
})
class HostCmp {
    readonly disabled = signal(false);
    readonly locale = signal<string | undefined>(undefined);
    readonly order = signal(400);
    inserted: string[] = [];
}

function slotEl(fixture: ComponentFixture<HostCmp>): HTMLElement | null {
    return fixture.nativeElement.querySelector('[data-addon-slot="emoji.insert"]');
}

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextEmojiDirective],
    template: `<ui-rich-text-editor mode="html" [uiRteEmoji]="enabled()"></ui-rich-text-editor>`,
})
class ToggleHostCmp {
    readonly enabled = signal(true);
}

describe('RichTextEmojiDirective', () => {
    const openFixtures: ComponentFixture<unknown>[] = [];

    function createFixture(): ComponentFixture<HostCmp> {
        const fixture = TestBed.createComponent(HostCmp);
        openFixtures.push(fixture);
        fixture.detectChanges();
        return fixture;
    }

    afterEach(() => {
        window.getSelection()?.removeAllRanges();
        while (openFixtures.length > 0) {
            const fixture = openFixtures.pop()!;
            if (!fixture.componentRef.hostView.destroyed) {
                fixture.destroy();
            }
        }
    });

    it('contributes the emoji picker as a component toolbar slot', () => {
        const fixture = createFixture();
        const slot = slotEl(fixture);
        expect(slot).toBeTruthy();
        expect(slot!.querySelector('button[title="Insert Emoji"]')).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(EmojiPickerComponent))).toBeTruthy();
    });

    it('inserts the picked emoji into the content and emits emojiInsert', () => {
        const fixture = createFixture();
        const picker = fixture.debugElement.query(By.directive(EmojiPickerComponent))
            .componentInstance as EmojiPickerComponent;

        picker.selectEmoji('🎉');
        fixture.detectChanges();

        const editor = fixture.nativeElement.querySelector('[contenteditable]') as HTMLElement;
        expect(editor.textContent).toContain('🎉');
        expect(fixture.componentInstance.inserted).toEqual(['🎉']);
    });

    it('does not insert while the editor is disabled', () => {
        const fixture = createFixture();
        fixture.componentInstance.disabled.set(true);
        fixture.detectChanges();

        const button = slotEl(fixture)!.querySelector('button') as HTMLButtonElement;
        expect(button.disabled).toBe(true);

        const picker = fixture.debugElement.query(By.directive(EmojiPickerComponent))
            .componentInstance as EmojiPickerComponent;
        picker.selectEmoji('🎉');
        fixture.detectChanges();

        expect(fixture.componentInstance.inserted).toEqual([]);
    });

    it('localizes the button tooltip', () => {
        const fixture = createFixture();
        fixture.componentInstance.locale.set('he');
        fixture.detectChanges();

        const button = slotEl(fixture)!.querySelector('button') as HTMLButtonElement;
        expect(button.title).toBe('הוספת אמוג\'י');
    });

    it('removes the slot live when uiRteEmoji flips to false and restores on re-enable', () => {
        const fixture = TestBed.createComponent(ToggleHostCmp);
        openFixtures.push(fixture);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[data-addon-slot="emoji.insert"]')).toBeTruthy();

        fixture.componentInstance.enabled.set(false);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[data-addon-slot="emoji.insert"]')).toBeFalsy();

        fixture.componentInstance.enabled.set(true);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[data-addon-slot="emoji.insert"]')).toBeTruthy();
    });

    it('re-registers without duplicating the slot when the order input changes', () => {
        const fixture = createFixture();
        fixture.componentInstance.order.set(100);
        fixture.detectChanges();

        const slots = fixture.nativeElement.querySelectorAll('[data-addon-slot="emoji.insert"]');
        expect(slots).toHaveLength(1);

        const picker = fixture.debugElement.query(By.directive(EmojiPickerComponent))
            .componentInstance as EmojiPickerComponent;
        picker.selectEmoji('🎈');
        fixture.detectChanges();
        expect(fixture.componentInstance.inserted).toEqual(['🎈']);
    });
});
