import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
  output,
  ElementRef,
  viewChild,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { createLocaleBindings, interpolate, type LocaleInput } from '../../lib/i18n';
import { FILE_UPLOAD_LOCALES, type FileUploadLocale } from './file-upload.locales';
import { ButtonComponent } from '../button';
import { ProgressComponent } from '../progress';

export interface FileUploadItem {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
  preview?: string;
}

@Component({
  selector: 'ui-file-upload',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, ProgressComponent],
  templateUrl: './file-upload.component.html',
  host: { class: 'block' },
})
export class FileUploadComponent {
  readonly accept = input('');
  readonly multiple = input(true);
  readonly maxFiles = input<number | null>(null);
  readonly maxSize = input<number | null>(null); // bytes
  readonly disabled = input(false);
  readonly class = input('');

  /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
  readonly locale = input<LocaleInput<FileUploadLocale>>();
  private readonly i18n = createLocaleBindings(this.locale, FILE_UPLOAD_LOCALES);
  protected readonly t = this.i18n.t;
  protected readonly dir = this.i18n.dir;

  readonly filesChange = output<FileUploadItem[]>();
  readonly fileAdded = output<FileUploadItem>();
  readonly fileRemoved = output<FileUploadItem>();
  readonly fileError = output<{ file: File; error: string }>();

  readonly files = signal<FileUploadItem[]>([]);
  readonly isDragging = signal(false);

  readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly isDisabled = computed(() => {
    if (this.disabled()) return true;
    const max = this.maxFiles();
    return max !== null && this.files().length >= max;
  });

  readonly classes = computed(() => cn('w-full', this.class()));

  /** Localised max-size label, e.g. `"Max size: 10 MB"`. Empty when `maxSize` is null. */
  readonly maxSizeLabel = computed(() => {
    const max = this.maxSize();
    if (max === null) return '';
    return interpolate(this.t().maxSize, { size: this.formatSize(max) });
  });

  readonly dropzoneClasses = computed(() =>
    cn(
      'relative flex min-h-[100px] sm:min-h-[150px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed p-4 sm:p-6 transition-colors',
      'hover:border-primary/50 hover:bg-accent/50',
      this.isDragging() && 'border-primary bg-accent',
      this.isDisabled() && 'cursor-not-allowed opacity-50'
    )
  );

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.isDisabled()) {
      this.isDragging.set(true);
    }
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    if (this.isDisabled()) return;

    const files = event.dataTransfer?.files;
    if (files) {
      this.addFiles(Array.from(files));
    }
  }

  openFilePicker() {
    if (!this.isDisabled()) {
      this.fileInput()?.nativeElement.click();
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(Array.from(input.files));
      input.value = '';
    }
  }

  addFiles(newFiles: File[]) {
    const currentFiles = this.files();
    const maxFiles = this.maxFiles();
    const maxSize = this.maxSize();
    const accept = this.accept();

    let available = maxFiles === null ? newFiles.length : maxFiles - currentFiles.length;

    for (const file of newFiles) {
      if (available <= 0) break;

      if (accept && !this.isAccepted(file, accept)) {
        this.fileError.emit({ file, error: this.t().fileTypeNotAccepted });
        continue;
      }
      if (maxSize !== null && file.size > maxSize) {
        this.fileError.emit({
          file,
          error: interpolate(this.t().fileTooLarge, { size: this.formatSize(maxSize) }),
        });
        continue;
      }

      const item: FileUploadItem = {
        file,
        id: crypto.randomUUID(),
        progress: 0,
        status: 'pending',
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      };

      this.files.update((f) => [...f, item]);
      this.fileAdded.emit(item);
      available--;
    }

    this.filesChange.emit(this.files());
  }

  removeFile(id: string, event?: MouseEvent) {
    event?.stopPropagation();
    const file = this.files().find((f) => f.id === id);
    if (file) {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
      this.files.update((f) => f.filter((item) => item.id !== id));
      this.fileRemoved.emit(file);
      this.filesChange.emit(this.files());
    }
  }

  updateFileProgress(id: string, progress: number) {
    const newStatus: FileUploadItem['status'] = progress >= 100 ? 'complete' : 'uploading';
    this.files.update((files) =>
      files.map((f) =>
        f.id === id ? { ...f, progress, status: newStatus } : f
      )
    );
  }

  setFileError(id: string, error: string) {
    this.files.update((files) =>
      files.map((f) => (f.id === id ? { ...f, status: 'error', error } : f))
    );
  }

  clearFiles() {
    this.files().forEach((f) => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    this.files.set([]);
    this.filesChange.emit([]);
  }

  private isAccepted(file: File, accept: string): boolean {
    const acceptedTypes = accept.split(',').map((t) => t.trim());
    return acceptedTypes.some((type) => {
      if (type.startsWith('.')) {
        return file.name.toLowerCase().endsWith(type.toLowerCase());
      }
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -1));
      }
      return file.type === type;
    });
  }

  formatSize(bytes: number | null): string {
    if (bytes === null) return '';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
}
