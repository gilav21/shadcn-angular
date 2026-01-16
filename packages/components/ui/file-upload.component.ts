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
import { cn } from '../lib/utils';
import { ButtonComponent } from './button.component';
import { ProgressComponent } from './progress.component';

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
    template: `
    <div [class]="classes()" [attr.data-slot]="'file-upload'">
      <div
        [class]="dropzoneClasses()"
        [attr.data-dragging]="isDragging() || null"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
        (click)="openFilePicker()"
      >
        <input
          #fileInput
          type="file"
          class="sr-only"
          [accept]="accept()"
          [multiple]="multiple()"
          [disabled]="isDisabled()"
          (change)="onFileSelected($event)"
        />
        @if (files().length === 0) {
          <div class="flex flex-col items-center gap-2 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-muted-foreground"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" x2="12" y1="3" y2="15"/>
            </svg>
            <div>
              <p class="text-sm font-medium">Drag & drop files here</p>
              <p class="text-xs text-muted-foreground">or click to browse</p>
            </div>
            @if (maxSize()) {
              <p class="text-xs text-muted-foreground">
                Max size: {{ formatSize(maxSize()) }}
              </p>
            }
          </div>
        } @else {
          <div class="w-full space-y-2">
            @for (file of files(); track file.id) {
              <div class="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                @if (file.preview) {
                  <img [src]="file.preview" alt="" class="h-10 w-10 rounded object-cover shrink-0" />
                } @else {
                  <div class="flex h-10 w-10 items-center justify-center rounded bg-muted shrink-0">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="text-muted-foreground"
                    >
                      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                      <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
                    </svg>
                  </div>
                }
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium truncate">{{ file.file.name }}</p>
                  <p class="text-xs text-muted-foreground">{{ formatSize(file.file.size) }}</p>
                  @if (file.status === 'uploading') {
                    <ui-progress [value]="file.progress" class="mt-1 h-1" />
                  }
                  @if (file.status === 'error' && file.error) {
                    <p class="text-xs text-destructive mt-1">{{ file.error }}</p>
                  }
                </div>
                <ui-button
                  type="button"
                  variant="outline"
                  class="shrink-0 rounded-full p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  (click)="removeFile(file.id, $event)"
                  aria-label="Remove file"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                  </svg>
                </ui-button>
              </div>
            }
            <ui-button
              type="button"
              variant="outline"
              class="w-full text-sm text-primary hover:underline"
              (click)="openFilePicker(); $event.stopPropagation()"
            >
              Add more files
            </ui-button>
          </div>
        }
      </div>
    </div>
  `,
    host: { class: 'block' },
})
export class FileUploadComponent {
    accept = input('');
    multiple = input(true);
    maxFiles = input<number | null>(null);
    maxSize = input<number | null>(null); // bytes
    disabled = input(false);
    class = input('');

    filesChange = output<FileUploadItem[]>();
    fileAdded = output<FileUploadItem>();
    fileRemoved = output<FileUploadItem>();
    fileError = output<{ file: File; error: string }>();

    files = signal<FileUploadItem[]>([]);
    isDragging = signal(false);

    fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

    isDisabled = computed(() => {
        if (this.disabled()) return true;
        const max = this.maxFiles();
        return max !== null && this.files().length >= max;
    });

    classes = computed(() => cn('w-full', this.class()));

    dropzoneClasses = computed(() =>
        cn(
            'relative flex min-h-[150px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors',
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

        let available = maxFiles !== null ? maxFiles - currentFiles.length : newFiles.length;

        for (const file of newFiles) {
            if (available <= 0) break;

            if (accept && !this.isAccepted(file, accept)) {
                this.fileError.emit({ file, error: 'File type not accepted' });
                continue;
            }
            if (maxSize !== null && file.size > maxSize) {
                this.fileError.emit({ file, error: `File exceeds maximum size of ${this.formatSize(maxSize)}` });
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
        this.files.update((files) =>
            files.map((f) =>
                f.id === id ? { ...f, progress, status: progress >= 100 ? 'complete' : 'uploading' } : f
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
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
    }
}
