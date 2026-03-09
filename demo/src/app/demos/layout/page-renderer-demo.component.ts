import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageViewerDemoComponent } from '../../page-viewer-demo.component';

@Component({
  selector: 'app-page-renderer-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageViewerDemoComponent],
  template: `
    <app-page-viewer-demo />
  `,
})
export class PageRendererDemoComponent {}
