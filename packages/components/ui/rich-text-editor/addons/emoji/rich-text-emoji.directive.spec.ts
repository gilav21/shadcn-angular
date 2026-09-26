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
    template: `<ui-rich-text-editor mode="html" [disabled]="disabled()" [uiRteEmoji]="{ order: order() }"
        [uiRteEmojiLocale]="locale()"
        (emojiInsert)="inserted.push($event)"></ui-rich-text-editor>`,
})
class HostCmp {
    readonly disabled = signal(false);
    readonly locale = signal<string | undefined>(undefined);
    readonly order = signal(400);
    inserted: string[] = [];
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

    it('inserts the picked emoji into the content and emits emojiInsert', () => {
        const fixture = createFixture();
        const picker = fixture.debugElement.query(By.directive(EmojiPickerComponent))
            .componentInstance as EmojiPickerComponent;

        picker.selectEmoji('🎉');
        fixture.detectChanges();

        const editor = fixture.nativeElement.querySelector('[contenteditable]') as HTMLElement;
        expect(editor.textContent).toBe('🎉');
        expect(fixture.componentInstance.inserted).toEqual(['🎉']);
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

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextEmojiDirective],
    template: `<ui-rich-text-editor mode="html" [locale]="editorLocale()" uiRteEmoji
        [uiRteEmojiLocale]="addonLocale()"></ui-rich-text-editor>`,
})
class CascadeHostCmp {
    readonly editorLocale = signal<string | undefined>(undefined);
    readonly addonLocale = signal<string | undefined>(undefined);
}

describe('RichTextEmojiDirective — locale cascade', () => {
    afterEach(() => TestBed.resetTestingModule());

    /** Create the cascade host with the given editor / addon locale inputs. */
    function createCascade(editorLocale?: string, addonLocale?: string): ComponentFixture<CascadeHostCmp> {
        const fixture = TestBed.createComponent(CascadeHostCmp);
        fixture.componentInstance.editorLocale.set(editorLocale);
        fixture.componentInstance.addonLocale.set(addonLocale);
        fixture.detectChanges();
        return fixture;
    }

    /** The emoji slot's toolbar button. */
    const slotButton = (fixture: ComponentFixture<CascadeHostCmp>): HTMLButtonElement =>
        fixture.nativeElement.querySelector(
            '[data-addon-slot="emoji.insert"] button',
        ) as HTMLButtonElement;

    // T-35
    it('T-35 resolves Hebrew from the editor locale with no uiRteEmojiLocale', () => {
        const fixture = createCascade('he');

        expect(slotButton(fixture).title).toBe('הוספת אמוג\'י');
    });

    it('T-35b the toolbar itself still receives the resolved locale object', () => {
        const fixture = createCascade('he');
        const bold = fixture.nativeElement.querySelector('button[data-toolbar-item="bold"]') as HTMLButtonElement;

        expect(bold.title).toContain('מודגש');
    });

    // T-36
    it('T-36 uiRteEmojiLocale wins over the editor locale', () => {
        const fixture = createCascade('he', 'en');

        expect(slotButton(fixture).title).toBe('Insert Emoji');
    });

    // T-39
    it('T-39 switching the editor locale at runtime re-localizes the addon', () => {
        const fixture = createCascade('en');
        expect(slotButton(fixture).title).toBe('Insert Emoji');

        fixture.componentInstance.editorLocale.set('he');
        fixture.detectChanges();

        expect(slotButton(fixture).title).toBe('הוספת אמוג\'י');
    });
});
