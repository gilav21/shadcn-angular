import { TestBed } from '@angular/core/testing';
import { PageViewerDemoComponent } from './page-viewer-demo.component';

describe('PageViewerDemoComponent', () => {
    it('renders the page from its context, and follows a change to that context', () => {
        TestBed.configureTestingModule({ imports: [PageViewerDemoComponent] });
        const fixture = TestBed.createComponent(PageViewerDemoComponent);
        fixture.detectChanges();
        const page = fixture.nativeElement.querySelector('ui-page-renderer') as HTMLElement;
        expect(page.textContent).toContain('Active Now1,250');

        fixture.componentInstance.context.update(ctx => ({ ...ctx, stats: { ...ctx.stats, activeUsers: 4321 } }));
        fixture.detectChanges();

        expect(page.textContent).toContain('Active Now4,321');
    });
});
