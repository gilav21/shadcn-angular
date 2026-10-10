import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FileViewerComponent } from '@/components/ui/file-viewer';

/**
 * Harness for the `file-viewer` component: a picker that hands the chosen file
 * to the viewer, so the spec can open documents the way a user does.
 */
@Component({
    selector: 'app-file-viewer-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FileViewerComponent],
    template: `
        <main class="p-8 space-y-4">
            <input type="file" data-testid="picker" aria-label="Open a file" (change)="pick($event)" />
            <ui-file-viewer data-testid="root" [file]="file()" height="500px" />
        </main>
    `,
})
export class FileViewerDemoComponent {
    protected readonly file = signal<File | null>(null);

    protected pick(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.file.set(input.files?.item(0) ?? null);
    }
}
