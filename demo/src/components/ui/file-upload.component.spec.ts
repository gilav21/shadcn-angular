import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileUploadComponent, FileUploadItem } from './file-upload.component';

// Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-file-upload
                [accept]="accept()"
                [multiple]="multiple()"
                [maxFiles]="maxFiles()"
                [maxSize]="maxSize()"
                [disabled]="disabled()"
                (filesChange)="onFilesChange($event)"
                (fileAdded)="onFileAdded($event)"
                (fileRemoved)="onFileRemoved($event)"
                (fileError)="onFileError($event)"
            />
        </div>
    `,
    imports: [FileUploadComponent]
})
class FileUploadTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
    accept = signal('');
    multiple = signal(true);
    maxFiles = signal<number | null>(null);
    maxSize = signal<number | null>(null);
    disabled = signal(false);

    files: FileUploadItem[] = [];
    addedFile: FileUploadItem | null = null;
    removedFile: FileUploadItem | null = null;
    lastError: { file: File; error: string } | null = null;

    onFilesChange(files: FileUploadItem[]) {
        this.files = files;
    }
    onFileAdded(file: FileUploadItem) {
        this.addedFile = file;
    }
    onFileRemoved(file: FileUploadItem) {
        this.removedFile = file;
    }
    onFileError(error: { file: File; error: string }) {
        this.lastError = error;
    }
}

function createMockFile(name: string, size: number, type: string): File {
    const content = new Array(size).fill('a').join('');
    return new File([content], name, { type });
}

describe('FileUploadComponent', () => {
    let fixture: ComponentFixture<FileUploadTestHostComponent>;
    let component: FileUploadTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [FileUploadTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(FileUploadTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        document.documentElement.removeAttribute('dir');
    });

    describe('Basic Rendering', () => {
        it('should create file upload component', () => {
            const upload = fixture.debugElement.query(By.directive(FileUploadComponent));
            expect(upload).toBeTruthy();
        });

        it('should have data-slot="file-upload"', () => {
            const upload = fixture.debugElement.query(By.css('[data-slot="file-upload"]'));
            expect(upload).toBeTruthy();
        });

        it('should render dropzone', () => {
            // Dropzone has border-dashed class always present
            const dropzone = fixture.debugElement.query(By.css('.border-dashed'));
            expect(dropzone).toBeTruthy();
        });

        it('should have hidden file input', () => {
            const input = fixture.debugElement.query(By.css('input[type="file"]'));
            expect(input).toBeTruthy();
            expect(input.nativeElement.className).toContain('sr-only');
        });
    });

    describe('File Selection', () => {
        it('should accept files through input', async () => {
            const uploadComponent = fixture.debugElement.query(By.directive(FileUploadComponent)).componentInstance as FileUploadComponent;
            const mockFile = createMockFile('test.pdf', 1024, 'application/pdf');

            uploadComponent.addFiles([mockFile]);
            fixture.detectChanges();

            expect(component.files.length).toBe(1);
            expect(component.files[0].file.name).toBe('test.pdf');
        });

        it('should emit fileAdded event', async () => {
            const uploadComponent = fixture.debugElement.query(By.directive(FileUploadComponent)).componentInstance as FileUploadComponent;
            const mockFile = createMockFile('test.pdf', 1024, 'application/pdf');

            uploadComponent.addFiles([mockFile]);
            fixture.detectChanges();

            expect(component.addedFile).toBeTruthy();
            expect(component.addedFile?.file.name).toBe('test.pdf');
        });

        it('should accept multiple files', async () => {
            const uploadComponent = fixture.debugElement.query(By.directive(FileUploadComponent)).componentInstance as FileUploadComponent;
            const file1 = createMockFile('test1.pdf', 1024, 'application/pdf');
            const file2 = createMockFile('test2.pdf', 1024, 'application/pdf');

            uploadComponent.addFiles([file1, file2]);
            fixture.detectChanges();

            expect(component.files.length).toBe(2);
        });
    });

    describe('Validation', () => {
        it('should reject files exceeding maxSize', async () => {
            component.maxSize.set(1024); // 1KB
            fixture.detectChanges();

            const uploadComponent = fixture.debugElement.query(By.directive(FileUploadComponent)).componentInstance as FileUploadComponent;
            const largeFile = createMockFile('large.pdf', 2048, 'application/pdf');

            uploadComponent.addFiles([largeFile]);
            fixture.detectChanges();

            expect(component.files.length).toBe(0);
            expect(component.lastError).toBeTruthy();
            expect(component.lastError?.error).toContain('maximum size');
        });

        it('should respect maxFiles limit', async () => {
            component.maxFiles.set(2);
            fixture.detectChanges();

            const uploadComponent = fixture.debugElement.query(By.directive(FileUploadComponent)).componentInstance as FileUploadComponent;
            const files = [
                createMockFile('file1.pdf', 100, 'application/pdf'),
                createMockFile('file2.pdf', 100, 'application/pdf'),
                createMockFile('file3.pdf', 100, 'application/pdf'),
            ];

            uploadComponent.addFiles(files);
            fixture.detectChanges();

            expect(component.files.length).toBe(2);
        });

        it('should validate file type with accept', async () => {
            component.accept.set('image/*');
            fixture.detectChanges();

            const uploadComponent = fixture.debugElement.query(By.directive(FileUploadComponent)).componentInstance as FileUploadComponent;
            const pdfFile = createMockFile('doc.pdf', 100, 'application/pdf');
            const imageFile = createMockFile('image.png', 100, 'image/png');

            uploadComponent.addFiles([pdfFile, imageFile]);
            fixture.detectChanges();

            expect(component.files.length).toBe(1);
            expect(component.files[0].file.name).toBe('image.png');
        });

        it('should validate extension-based accept', async () => {
            component.accept.set('.pdf,.doc');
            fixture.detectChanges();

            const uploadComponent = fixture.debugElement.query(By.directive(FileUploadComponent)).componentInstance as FileUploadComponent;
            const pdfFile = createMockFile('doc.pdf', 100, 'application/pdf');
            const txtFile = createMockFile('text.txt', 100, 'text/plain');

            uploadComponent.addFiles([pdfFile, txtFile]);
            fixture.detectChanges();

            expect(component.files.length).toBe(1);
            expect(component.files[0].file.name).toBe('doc.pdf');
        });
    });

    describe('File Removal', () => {
        it('should remove file', async () => {
            const uploadComponent = fixture.debugElement.query(By.directive(FileUploadComponent)).componentInstance as FileUploadComponent;
            const mockFile = createMockFile('test.pdf', 1024, 'application/pdf');

            uploadComponent.addFiles([mockFile]);
            fixture.detectChanges();

            const fileId = component.files[0].id;
            uploadComponent.removeFile(fileId);
            fixture.detectChanges();

            expect(component.files.length).toBe(0);
        });

        it('should emit fileRemoved event', async () => {
            const uploadComponent = fixture.debugElement.query(By.directive(FileUploadComponent)).componentInstance as FileUploadComponent;
            const mockFile = createMockFile('test.pdf', 1024, 'application/pdf');

            uploadComponent.addFiles([mockFile]);
            fixture.detectChanges();

            const fileId = component.files[0].id;
            uploadComponent.removeFile(fileId);
            fixture.detectChanges();

            expect(component.removedFile).toBeTruthy();
            expect(component.removedFile?.file.name).toBe('test.pdf');
        });

        it('should clear all files', async () => {
            const uploadComponent = fixture.debugElement.query(By.directive(FileUploadComponent)).componentInstance as FileUploadComponent;
            uploadComponent.addFiles([
                createMockFile('file1.pdf', 100, 'application/pdf'),
                createMockFile('file2.pdf', 100, 'application/pdf'),
            ]);
            fixture.detectChanges();

            uploadComponent.clearFiles();
            fixture.detectChanges();

            expect(component.files.length).toBe(0);
        });
    });

    describe('Disabled State', () => {
        beforeEach(async () => {
            component.disabled.set(true);
            fixture.detectChanges();
            await fixture.whenStable();
        });

        it('should have disabled input', () => {
            const input = fixture.debugElement.query(By.css('input[type="file"]'));
            expect(input.nativeElement.disabled).toBe(true);
        });

        it('should have opacity class on dropzone', () => {
            const dropzone = fixture.debugElement.query(By.css('.border-dashed'));
            expect(dropzone.nativeElement.className).toContain('opacity-50');
        });
    });

    describe('RTL Support', () => {
        it('should render in LTR mode', () => {
            const container = fixture.debugElement.query(By.css('[dir="ltr"]'));
            expect(container).toBeTruthy();
        });

        it('should render in RTL mode', async () => {
            component.dir.set('rtl');
            fixture.detectChanges();
            await fixture.whenStable();

            const container = fixture.debugElement.query(By.css('[dir="rtl"]'));
            expect(container).toBeTruthy();
        });

        it('should maintain structure in RTL', async () => {
            component.dir.set('rtl');
            fixture.detectChanges();
            await fixture.whenStable();

            const upload = fixture.debugElement.query(By.directive(FileUploadComponent));
            expect(upload).toBeTruthy();
        });
    });

    describe('Accessibility', () => {
        it('should have accessible file input', () => {
            const input = fixture.debugElement.query(By.css('input[type="file"]'));
            expect(input.nativeElement.type).toBe('file');
        });

        it('should have aria-label on remove buttons', async () => {
            const uploadComponent = fixture.debugElement.query(By.directive(FileUploadComponent)).componentInstance as FileUploadComponent;
            uploadComponent.addFiles([createMockFile('test.pdf', 100, 'application/pdf')]);
            fixture.detectChanges();

            const removeBtn = fixture.debugElement.query(By.css('[aria-label="Remove file"]'));
            expect(removeBtn).toBeTruthy();
        });
    });

    describe('Security', () => {
        it('should generate unique IDs for files', async () => {
            const uploadComponent = fixture.debugElement.query(By.directive(FileUploadComponent)).componentInstance as FileUploadComponent;
            uploadComponent.addFiles([
                createMockFile('file1.pdf', 100, 'application/pdf'),
                createMockFile('file2.pdf', 100, 'application/pdf'),
            ]);
            fixture.detectChanges();

            const ids = component.files.map(f => f.id);
            expect(new Set(ids).size).toBe(2);
        });

        it('should sanitize file names in display', async () => {
            const uploadComponent = fixture.debugElement.query(By.directive(FileUploadComponent)).componentInstance as FileUploadComponent;
            uploadComponent.addFiles([createMockFile('<script>alert(1)</script>.pdf', 100, 'application/pdf')]);
            fixture.detectChanges();

            const fileList = fixture.debugElement.query(By.css('.truncate'));
            expect(fileList.nativeElement.innerHTML).not.toContain('<script>');
        });

        it('should handle malformed file objects gracefully', () => {
            const uploadComponent = fixture.debugElement.query(By.directive(FileUploadComponent)).componentInstance as FileUploadComponent;

            expect(() => {
                uploadComponent.addFiles([]);
            }).not.toThrow();
        });

        it('should revoke object URLs on file removal', async () => {
            const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');
            const uploadComponent = fixture.debugElement.query(By.directive(FileUploadComponent)).componentInstance as FileUploadComponent;

            uploadComponent.addFiles([createMockFile('test.png', 100, 'image/png')]);
            fixture.detectChanges();

            const fileId = component.files[0].id;
            uploadComponent.removeFile(fileId);
            fixture.detectChanges();

            expect(revokeObjectURLSpy).toHaveBeenCalled();
            revokeObjectURLSpy.mockRestore();
        });
    });
});
