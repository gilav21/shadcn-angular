import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { RichTextEditorComponent } from './rich-text-editor.component';

describe('RichTextEditorComponent', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        editor = fixture.nativeElement.querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
    });

    it('prevents replacements that would exceed maxLength', () => {
        fixture.componentRef.setInput('maxLength', 5);
        fixture.detectChanges();

        component.writeValue('hello');
        fixture.detectChanges();

        const selection = document.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        selection?.removeAllRanges();
        selection?.addRange(range);

        const beforeInput = new InputEvent('beforeinput', {
            bubbles: true,
            cancelable: true,
            data: 'toolong',
            inputType: 'insertText',
        });
        editor.dispatchEvent(beforeInput);

        expect(beforeInput.defaultPrevented).toBe(true);
    });

    it('supports undo after truncated paste path', () => {
        fixture.componentRef.setInput('maxLength', 5);
        fixture.detectChanges();

        editor.innerHTML = 'abc';
        editor.dispatchEvent(new Event('input', { bubbles: true }));

        const textNode = editor.firstChild as Text;
        const selection = document.getSelection();
        const range = document.createRange();
        range.setStart(textNode, textNode.length);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);

        component.onPaste({
            preventDefault: vi.fn(),
            clipboardData: {
                getData: (type: string) => (type === 'text/plain' ? 'defgh' : ''),
            } as DataTransfer,
        } as unknown as ClipboardEvent);

        expect(editor.textContent).toBe('abcde');

        const undoEvent = new KeyboardEvent('keydown', {
            key: 'z',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
        });
        component.onKeydown(undoEvent);

        expect(editor.textContent).toBe('abc');
    });

    it('does not throw when formatting a partial multi-node selection', () => {
        component.writeValue('<p>Hello <b>World</b></p>');
        fixture.detectChanges();

        const p = editor.querySelector('p') as HTMLParagraphElement;
        const plainText = p.firstChild as Text;
        const boldText = p.querySelector('b')?.firstChild as Text;

        const selection = document.getSelection();
        const range = document.createRange();
        range.setStart(plainText, 2);
        range.setEnd(boldText, 3);
        selection?.removeAllRanges();
        selection?.addRange(range);

        expect(() => component.onFormatCommand('code')).not.toThrow();
    });

    it('pastes clipboard image as data URL when uploader is not configured', async () => {
        const imageFile = new File(['paste-image'], 'clip.png', { type: 'image/png' });
        const uploadCompleteSpy = vi.spyOn(component.imageUploadComplete, 'emit');
        const uploadErrorSpy = vi.spyOn(component.imageUploadError, 'emit');

        await component.onPaste({
            preventDefault: vi.fn(),
            clipboardData: {
                files: [imageFile],
                getData: () => '',
            } as unknown as DataTransfer,
        } as unknown as ClipboardEvent);

        expect(editor.innerHTML).toContain('<img');
        expect(editor.innerHTML).toContain('data:image/png;base64');
        expect(uploadCompleteSpy).toHaveBeenCalled();
        expect(uploadErrorSpy).not.toHaveBeenCalled();
    });

    it('pastes clipboard image via uploader when configured', async () => {
        fixture.componentRef.setInput('imageSources', 'upload');
        fixture.componentRef.setInput('imageUploader', () => of('https://cdn.example.com/clip.png'));
        fixture.detectChanges();

        const imageFile = new File(['paste-image'], 'clip.png', { type: 'image/png' });
        const uploadCompleteSpy = vi.spyOn(component.imageUploadComplete, 'emit');
        const uploadErrorSpy = vi.spyOn(component.imageUploadError, 'emit');

        await component.onPaste({
            preventDefault: vi.fn(),
            clipboardData: {
                files: [imageFile],
                getData: () => '',
            } as unknown as DataTransfer,
        } as unknown as ClipboardEvent);

        expect(editor.innerHTML).toContain('https://cdn.example.com/clip.png');
        expect(uploadCompleteSpy).toHaveBeenCalledWith('https://cdn.example.com/clip.png');
        expect(uploadErrorSpy).not.toHaveBeenCalled();
    });

    it('does not allow attribute injection through image alt text', () => {
        component.onImageInsert({
            src: 'https://example.com/safe.png',
            alt: 'x" onerror="alert(1)" data-x="1',
        });

        const img = editor.querySelector('img') as HTMLImageElement | null;
        expect(img).toBeTruthy();
        expect(img?.getAttribute('src')).toBe('https://example.com/safe.png');
        expect(img?.getAttribute('onerror')).toBeNull();
        expect(img?.attributes.getNamedItem('onerror')).toBeNull();
        expect(img?.getAttribute('alt')).toContain('onerror=');
    });
});
