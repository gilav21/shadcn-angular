import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    BreadcrumbComponent,
    BreadcrumbListComponent,
    BreadcrumbItemComponent,
    BreadcrumbLinkComponent,
    BreadcrumbPageComponent,
    BreadcrumbSeparatorComponent,
    BreadcrumbEllipsisComponent,
} from '@/components/ui/breadcrumb';

/**
 * Auto-generated harness for the `breadcrumb` component.
 * Extend the template and assertions in `breadcrumb.spec.ts` as needed.
 */
@Component({
    selector: 'app-breadcrumb-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [BreadcrumbComponent, BreadcrumbListComponent, BreadcrumbItemComponent, BreadcrumbLinkComponent, BreadcrumbPageComponent, BreadcrumbSeparatorComponent, BreadcrumbEllipsisComponent],
    template: `
        <main class="p-8">
            <ui-breadcrumb data-testid="root">
                <ui-breadcrumb-list data-testid="breadcrumb-list"></ui-breadcrumb-list>
                <ui-breadcrumb-item data-testid="breadcrumb-item"></ui-breadcrumb-item>
                <ui-breadcrumb-link data-testid="breadcrumb-link"></ui-breadcrumb-link>
                <ui-breadcrumb-page data-testid="breadcrumb-page"></ui-breadcrumb-page>
                <ui-breadcrumb-separator data-testid="breadcrumb-separator"></ui-breadcrumb-separator>
                <ui-breadcrumb-ellipsis data-testid="breadcrumb-ellipsis"></ui-breadcrumb-ellipsis>
            </ui-breadcrumb>
        </main>
    `,
})
export class BreadcrumbDemoComponent {}
