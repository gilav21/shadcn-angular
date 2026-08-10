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
  /**
   * Comma-separated filter in native `accept` syntax — extensions (`.pdf`), wildcard
   * MIME (`image/*`) and exact MIME (`application/pdf`) are all honoured, and it is
   * re-checked in JS on drop (where the browser cannot enforce it). Empty (default)
   * accepts everything. A rejected file is dropped silently from the list and reported
   * on {@link fileError} only.
   */
  readonly accept = input('');
  /**
   * Sets the native input's `multiple` flag — it only limits what one picker
   * *selection* can contain. Drag-and-drop is not gated by it, and repeated picks
   * append, so use {@link maxFiles} to actually cap the list at one.
   */
  readonly multiple = input(true);
  /**
   * Cap on total queued files (`null` = unlimited). Extra files in a batch are
   * discarded once the cap is reached — with no {@link fileError} for the overflow —
   * and the dropzone disables itself while the list is full.
   */
  readonly maxFiles = input<number | null>(null);
  /**
   * Per-file size ceiling **in bytes** (`null` = unlimited). Oversized files are
   * rejected with a localised message on {@link fileError}; the limit is also
   * surfaced in the dropzone caption.
   */
  readonly maxSize = input<number | null>(null);
  /** Blocks picking, dropping and the dimmed dropzone. Already-queued files stay listed and removable. */
  readonly disabled = input(false);
  /** Extra classes merged onto the `w-full` wrapper (not the dropzone itself). */
  readonly class = input('');

  /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
  readonly locale = input<LocaleInput<FileUploadLocale>>();
  private readonly i18n = createLocaleBindings(this.locale, FILE_UPLOAD_LOCALES);
  protected readonly t = this.i18n.t;
  protected readonly dir = this.i18n.dir;

  /**
   * The whole queue after any add, remove or clear — emitted once per batch, not per
   * file, and also when a batch added nothing. Progress and status changes made via
   * {@link updateFileProgress} / {@link setFileError} do **not** re-emit it.
   */
  readonly filesChange = output<FileUploadItem[]>();
  /**
   * Emitted per accepted file, carrying the wrapper whose `id` you need to report
   * progress back. Nothing is transferred anywhere — the component only queues files;
   * perform the actual upload here and feed results back through
   * {@link updateFileProgress} / {@link setFileError}.
   */
  readonly fileAdded = output<FileUploadItem>();
  /** Emitted with the removed item after its object-URL preview has already been revoked. */
  readonly fileRemoved = output<FileUploadItem>();
  /**
   * The only signal that a file was refused — rejected files never enter the queue and
   * nothing is rendered for them, so surface this yourself. `error` is a localised
   * message for a MIME/extension mismatch ({@link accept}) or an oversized file
   * ({@link maxSize}); files dropped for exceeding {@link maxFiles} are silent.
   */
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

  /**
   * Marks the dropzone as an active drop target and cancels the event so the browser
   * does not navigate to the dragged file. The highlight is suppressed while disabled,
   * but the default is still prevented.
   */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.isDisabled()) {
      this.isDragging.set(true);
    }
  }

  /**
   * Clears the drag highlight. Bound on the dropzone itself, so dragging across a
   * queued-file row inside it can flicker the highlight off and on.
   */
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  /**
   * Takes the dropped `DataTransfer` files through {@link addFiles}, where
   * {@link accept} and {@link maxSize} are enforced in JS — the browser applies neither
   * to a drop. Only `dataTransfer.files` is read, so dropped folders are not walked.
   */
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    if (this.isDisabled()) return;

    const files = event.dataTransfer?.files;
    if (files) {
      this.addFiles(Array.from(files));
    }
  }

  /**
   * Opens the OS file dialog by clicking the hidden `<input type="file">`. Safe to call
   * from your own trigger, but browsers only honour it inside a user-gesture handler.
   * No-op while disabled or at the {@link maxFiles} cap.
   */
  openFilePicker(): void {
    if (!this.isDisabled()) {
      this.fileInput()?.nativeElement.click();
    }
  }

  /**
   * `(change)` handler for the hidden input. Queues the picked files and then resets
   * the input's value, so re-picking the exact same file still fires a change and
   * re-adds it — the component does not de-duplicate by name or content.
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(Array.from(input.files));
      input.value = '';
    }
  }

  /**
   * Validation + queueing entry point, also callable directly to seed files
   * programmatically. Each file is checked against {@link accept} then {@link maxSize}
   * (first failure wins, emitting one {@link fileError}); survivors are appended with
   * `status: 'pending'`, a fresh `crypto.randomUUID()` id and — for `image/*` — an
   * object-URL `preview` that this component revokes on remove/clear. The batch stops
   * once {@link maxFiles} is reached, and {@link filesChange} is emitted once at the end.
   */
  addFiles(newFiles: File[]): void {
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

  /**
   * Drops one queued file by `id`, revoking its preview URL and emitting
   * {@link fileRemoved} then {@link filesChange}. Pass the DOM `event` when calling from
   * a control inside the dropzone so the click does not bubble up and reopen the file
   * picker. Unknown ids are ignored. Removal only forgets the file — an upload already
   * in flight is yours to abort.
   */
  removeFile(id: string, event?: Event): void {
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

  /**
   * Reports upload progress for one queued file from your transfer code: `0…99` shows
   * the progress bar and sets `status: 'uploading'`, `>= 100` flips it to `'complete'`
   * and hides the bar. Does not re-emit {@link filesChange}, and will resurrect a file
   * previously marked via {@link setFileError}.
   */
  updateFileProgress(id: string, progress: number): void {
    const newStatus: FileUploadItem['status'] = progress >= 100 ? 'complete' : 'uploading';
    this.files.update((files) =>
      files.map((f) =>
        f.id === id ? { ...f, progress, status: newStatus } : f
      )
    );
  }

  /**
   * Marks a queued file as failed and renders `error` under its name — for *your*
   * upload failures. Pass an already-localised string; unlike the validation path it
   * does not emit {@link fileError}, and the file stays in the queue until removed.
   */
  setFileError(id: string, error: string): void {
    this.files.update((files) =>
      files.map((f) => (f.id === id ? { ...f, status: 'error', error } : f))
    );
  }

  /**
   * Empties the queue, revoking every preview URL and emitting a single
   * {@link filesChange} with `[]`. No per-file {@link fileRemoved} is emitted.
   */
  clearFiles(): void {
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

  /**
   * Human-readable byte count using binary (1024) steps up to `GB`, one decimal place
   * with trailing zeros trimmed (`1.5 MB`, `10 KB`). `null` → `''`, `0` → `'0 B'`.
   * Units are not localised.
   */
  formatSize(bytes: number | null): string {
    if (bytes === null) return '';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
}
