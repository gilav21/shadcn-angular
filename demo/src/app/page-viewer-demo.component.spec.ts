import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PageViewerDemoComponent } from './page-viewer-demo.component';
import { PageRendererComponent } from '../../../packages/components/ui/page-builder/page-renderer.component';
import { CardComponent } from '../../../packages/components/ui';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

describe('PageViewerDemoComponent', () => {
    let component: PageViewerDemoComponent;
    let fixture: ComponentFixture<PageViewerDemoComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                PageViewerDemoComponent,
                PageRendererComponent,
                CardComponent,
                FormsModule,
                CommonModule,
                BrowserAnimationsModule,
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(PageViewerDemoComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render page renderer', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('ui-page-renderer')).toBeTruthy();
    });

    it('should have initial context', () => {
        const ctx = component.context();
        expect(ctx.meta.title).toBe('Financial Dashboard');
        expect(ctx.stats.activeUsers).toBe(1250);
    });

    it('should update context on meta input change', () => {
        component.updateMeta('title', 'New Title');
        expect(component.context().meta.title).toBe('New Title');
    });

    it('should randomize data', () => {
        const initialRevenue = component.context().stats.totalRevenue;
        component.randomizeData();
        expect(component.context().stats.totalRevenue).not.toBe(initialRevenue);
    });
});
