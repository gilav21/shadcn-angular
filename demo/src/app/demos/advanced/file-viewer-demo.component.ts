import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  ButtonComponent,
  CodeBlockComponent,
  FileViewerComponent
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-file-viewer-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    CodeBlockComponent,
    FileViewerComponent
  ],
  template: `
    <section class="space-y-8">
      <div>
        <h2 id="file-viewer" class="text-2xl font-semibold scroll-m-20">File Viewer</h2>
        <p class="text-muted-foreground mt-1">
          A client-side file previewer supporting PDF, DOCX, XLSX, PPTX, images, text, video, and audio — no server or external packages required.
        </p>
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">Quick Demos</h3>
        <div class="flex flex-wrap gap-2">
          <ui-button variant="outline" size="sm" (click)="setFileViewerDemo('text')">Text File</ui-button>
          <ui-button variant="outline" size="sm" (click)="setFileViewerDemo('svg')">SVG Image</ui-button>
          <ui-button variant="outline" size="sm" (click)="loadPdfFromUrl()">PDF (Hebrew)</ui-button>
          <ui-button variant="outline" size="sm" (click)="loadComplexPdfFromUrl()">PDF (Complex Hebrew)</ui-button>
        </div>
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-medium">Try Your Own File</h3>
        <div class="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
             (dragover)="$event.preventDefault()"
             (drop)="onFileViewerDrop($event)">
          <p class="mb-2">Drag & drop a file here, or</p>
          <label class="inline-flex items-center gap-1.5 text-sm text-primary hover:underline cursor-pointer">
            <input type="file" class="hidden" (change)="onFileViewerSelect($event)" />
            browse to select
          </label>
          <p class="text-xs mt-2">Supports PDF, DOCX, XLSX, PPTX, images, text, video, audio</p>
        </div>
      </div>

      @if (fileViewerFile()) {
        <div class="space-y-2">
          <h3 class="text-lg font-medium">Simple Mode</h3>
          <p class="text-sm text-muted-foreground">Uses input-driven API — just pass the file.</p>
          <ui-file-viewer [file]="fileViewerFile()" height="1000px" />
        </div>
      }

      <div class="space-y-2">
        <h3 class="text-lg font-medium">Usage</h3>
        <ui-code-block language="html" [code]="usageCode" />
      </div>
    </section>
  `,
})
export class FileViewerDemoComponent {
  readonly fileViewerFile = signal<File | null>(null);

  readonly usageCode = `<!-- Simple mode: just pass a file -->
<ui-file-viewer [file]="myFile" height="500px" />

<!-- With URL source -->
<ui-file-viewer src="https://example.com/document.pdf" />

<!-- Custom mode: full control -->
<ui-file-viewer [file]="myFile">
  <ui-file-viewer-toolbar>
    <div class="px-3 py-2 border-b">Custom toolbar</div>
  </ui-file-viewer-toolbar>
  <ui-file-viewer-content />
</ui-file-viewer>

<!-- With event handling -->
<ui-file-viewer
  [file]="myFile"
  height="600px"
  [zoom]="1"
  [page]="1"
  filename="report.pdf"
  (loaded)="onLoaded($event)"
  (error)="onError($event)"
  (pageChange)="onPage($event)"
  (zoomChange)="onZoom($event)" />`;

  onFileViewerDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) this.fileViewerFile.set(file);
  }

  onFileViewerSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.fileViewerFile.set(file);
  }

  loadPdfFromUrl(): void {
    fetch('/test2.pdf')
      .then(r => r.blob())
      .then(blob => {
        const file = new File([blob], 'test2.pdf', { type: 'application/pdf' });
        this.fileViewerFile.set(file);
      });
  }

  loadComplexPdfFromUrl(): void {
    fetch('/DW2-3-Viruses-www.underwar.co.il.pdf')
      .then(r => r.blob())
      .then(blob => {
        const file = new File([blob], 'DW2-3-Viruses-www.underwar.co.il.pdf', { type: 'application/pdf' });
        this.fileViewerFile.set(file);
      });
  }

  setFileViewerDemo(type: string): void {
    const demos: Record<string, () => File> = {
      text: () => new File(
        ['# Hello World\n\nThis is a **sample** text file.\n\n- Item 1\n- Item 2\n- Item 3\n\n```typescript\nconst greeting = "Hello!";\nconsole.log(greeting);\n```'],
        'readme.md', { type: 'text/plain' }
      ),
      svg: () => new File(
        ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#4F46E5"/><stop offset="100%" stop-color="#7C3AED"/></linearGradient></defs><rect width="200" height="200" rx="20" fill="url(#g)"/><text x="100" y="110" text-anchor="middle" fill="white" font-size="24" font-family="sans-serif">SVG</text></svg>'],
        'logo.svg', { type: 'image/svg+xml' }
      ),
    };
    const fn = demos[type];
    if (fn) this.fileViewerFile.set(fn());
  }
}
