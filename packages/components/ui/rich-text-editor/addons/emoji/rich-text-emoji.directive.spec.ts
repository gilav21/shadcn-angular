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

    it('T-43 picking an emoji creates exactly one history entry', () => {
        const fixture = createFixture();
        const editorCmp = fixture.debugElement.query(By.directive(RichTextEditorComponent))
            .componentInstance as RichTextEditorComponent;
        const stackLength = (): number =>
            (editorCmp as unknown as { snapshots: unknown[] }).snapshots.length;
        const picker = fixture.debugElement.query(By.directive(EmojiPickerComponent))
            .componentInstance as EmojiPickerComponent;

        const before = stackLength();
        picker.selectEmoji('🎉');
        fixture.detectChanges();

        expect(stackLength() - before).toBe(1);

        const editor = fixture.nativeElement.querySelector('[contenteditable]') as HTMLElement;
        expect(editor.textContent).toContain('🎉');
        editor.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'z', ctrlKey: true, bubbles: true, cancelable: true,
        }));
        fixture.detectChanges();

        expect(editor.textContent).not.toContain('🎉');
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
