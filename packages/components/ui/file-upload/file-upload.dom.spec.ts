import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileUploadComponent, FileUploadItem } from './file-upload.component';

// jsdom (esp. under jest) lacks the object-URL APIs — polyfill only when absent.
const urlApi = URL as unknown as {
  createObjectURL?: (blob: unknown) => string;
  revokeObjectURL?: (url: string) => void;
};
urlApi.createObjectURL ??= () => 'blob:mock';
urlApi.revokeObjectURL ??= () => undefined;

function makeFile(name: string, size: number, type: string): File {
  return new File(['a'.repeat(size)], name, { type });
}

function dropEvent(files: File[]): Event {
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: { files },
    configurable: true,
  });
  return event;
}

function dragEvent(name: string): Event {
  const event = new Event(name, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: { files: [] },
    configurable: true,
  });
  return event;
}

describe('FileUploadComponent — DOM interactions', () => {
  let fixture: ComponentFixture<FileUploadComponent>;
  let component: FileUploadComponent;
  let dropzone: HTMLElement;
  let input: HTMLInputElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileUploadComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(FileUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    dropzone = fixture.debugElement.query(By.css('[role="presentation"]')).nativeElement;
    input = fixture.debugElement.query(By.css('input[type="file"]')).nativeElement;
  });

  describe('drag and drop', () => {
    it('highlights on dragover and resets on dragleave', () => {
      dropzone.dispatchEvent(dragEvent('dragover'));
      expect(component.isDragging()).toBe(true);

      dropzone.dispatchEvent(dragEvent('dragleave'));
      expect(component.isDragging()).toBe(false);
    });

    it('does not highlight on dragover when disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      dropzone.dispatchEvent(dragEvent('dragover'));
      expect(component.isDragging()).toBe(false);
    });

    it('adds dropped files and clears the dragging flag', () => {
      component.isDragging.set(true);
      const added: FileUploadItem[] = [];
      component.fileAdded.subscribe((item) => added.push(item));

      dropzone.dispatchEvent(dropEvent([makeFile('drop.pdf', 64, 'application/pdf')]));
      fixture.detectChanges();

      expect(component.isDragging()).toBe(false);
      expect(component.files()).toHaveLength(1);
      expect(added).toHaveLength(1);
    });

    it('ignores drops while disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      dropzone.dispatchEvent(dropEvent([makeFile('drop.pdf', 64, 'application/pdf')]));
      fixture.detectChanges();

      expect(component.files()).toHaveLength(0);
    });

    it('is a no-op when a drop carries no dataTransfer files', () => {
      const event = new Event('drop', { bubbles: true, cancelable: true });
      dropzone.dispatchEvent(event);
      fixture.detectChanges();

      expect(component.files()).toHaveLength(0);
    });
  });

  describe('file picker', () => {
    it('opens the native picker on dropzone click', () => {
      const clickSpy = vi.spyOn(input, 'click');
      dropzone.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(clickSpy).toHaveBeenCalled();
      clickSpy.mockRestore();
    });

    it('does not open the picker when disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      const clickSpy = vi.spyOn(input, 'click');

      dropzone.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(clickSpy).not.toHaveBeenCalled();
      clickSpy.mockRestore();
    });

    it('adds files from an input change and resets the input value', () => {
      const file = makeFile('picked.pdf', 32, 'application/pdf');
      Object.defineProperty(input, 'files', {
        value: [file],
        configurable: true,
      });

      input.dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();

      expect(component.files()).toHaveLength(1);
      expect(component.files()[0].file.name).toBe('picked.pdf');
      expect(input.value).toBe('');
    });
  });

  describe('progress and error state', () => {
    it('marks a file uploading below 100 and complete at 100', () => {
      component.addFiles([makeFile('p.pdf', 32, 'application/pdf')]);
      const id = component.files()[0].id;

      component.updateFileProgress(id, 40);
      expect(component.files()[0].status).toBe('uploading');
      expect(component.files()[0].progress).toBe(40);

      component.updateFileProgress(id, 100);
      expect(component.files()[0].status).toBe('complete');
    });

    it('sets an error status and message on a file', () => {
      component.addFiles([makeFile('e.pdf', 32, 'application/pdf')]);
      const id = component.files()[0].id;

      component.setFileError(id, 'upload failed');
      expect(component.files()[0].status).toBe('error');
      expect(component.files()[0].error).toBe('upload failed');
    });
  });

  describe('validation and formatting helpers', () => {
    it('accepts a file whose MIME type exactly matches accept', () => {
      fixture.componentRef.setInput('accept', 'application/pdf');
      fixture.detectChanges();

      component.addFiles([
        makeFile('ok.pdf', 16, 'application/pdf'),
        makeFile('no.txt', 16, 'text/plain'),
      ]);

      expect(component.files()).toHaveLength(1);
      expect(component.files()[0].file.name).toBe('ok.pdf');
    });

    it('formats null and zero byte totals', () => {
      expect(component.formatSize(null)).toBe('');
      expect(component.formatSize(0)).toBe('0 B');
    });
  });

  describe('clearFiles with previews', () => {
    it('revokes object URLs for image previews when cleared', () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
      component.addFiles([makeFile('pic.png', 16, 'image/png')]);
      expect(component.files()[0].preview).toBeTruthy();

      component.clearFiles();
      expect(revokeSpy).toHaveBeenCalled();
      expect(component.files()).toHaveLength(0);
      revokeSpy.mockRestore();
    });
  });
});
