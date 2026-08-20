/**
 * @title Loading, empty and loaded in one list
 * @summary The three states every data view needs — skeletons while fetching, an empty state, then cards.
 * @components card, skeleton, empty, badge, button
 */
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { BadgeComponent } from '@/components/ui/badge';
import { ButtonComponent } from '@/components/ui/button';
import {
    CardComponent,
    CardContentComponent,
    CardDescriptionComponent,
    CardHeaderComponent,
    CardTitleComponent,
} from '@/components/ui/card';
import {
    EmptyComponent,
    EmptyDescriptionComponent,
    EmptyHeaderComponent,
    EmptyTitleComponent,
} from '@/components/ui/empty';
import { SkeletonComponent } from '@/components/ui/skeleton';

interface Project {
    readonly id: string;
    readonly name: string;
    readonly status: string;
}

/**
 * The state machine every list gets wrong once.
 *
 * A data view has three states, not one, and they are not interchangeable: a
 * spinner where a skeleton belongs makes the layout jump when data lands, and
 * an empty grid where an empty state belongs reads as a bug. Model the state
 * explicitly — `loading` first, then `items.length === 0`, then the list — and
 * render skeletons with the same shape as the real cards so nothing reflows.
 */
@Component({
    selector: 'app-loading-to-loaded-list',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        BadgeComponent,
        ButtonComponent,
        CardComponent,
        CardContentComponent,
        CardDescriptionComponent,
        CardHeaderComponent,
        CardTitleComponent,
        EmptyComponent,
        EmptyDescriptionComponent,
        EmptyHeaderComponent,
        EmptyTitleComponent,
        SkeletonComponent,
    ],
    template: `
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <ui-button (clicked)="load()" data-testid="load">Load</ui-button>
        <ui-button variant="outline" (clicked)="loadEmpty()" data-testid="load-empty">
          Load nothing
        </ui-button>
      </div>

      @if (loading()) {
        <div class="grid gap-4 sm:grid-cols-2" data-testid="loading">
          @for (placeholder of placeholders; track placeholder) {
            <ui-card>
              <ui-card-header>
                <ui-skeleton class="h-5 w-40" />
                <ui-skeleton class="h-4 w-56" />
              </ui-card-header>
              <ui-card-content>
                <ui-skeleton class="h-4 w-24" />
              </ui-card-content>
            </ui-card>
          }
        </div>
      } @else if (isEmpty()) {
        <ui-empty data-testid="empty">
          <ui-empty-header>
            <ui-empty-title>No projects yet</ui-empty-title>
            <ui-empty-description>
              Create one and it will show up here.
            </ui-empty-description>
          </ui-empty-header>
        </ui-empty>
      } @else {
        <div class="grid gap-4 sm:grid-cols-2" data-testid="loaded">
          @for (project of projects(); track project.id) {
            <ui-card>
              <ui-card-header>
                <ui-card-title>{{ project.name }}</ui-card-title>
                <ui-card-description>Updated moments ago</ui-card-description>
              </ui-card-header>
              <ui-card-content>
                <ui-badge variant="secondary">{{ project.status }}</ui-badge>
              </ui-card-content>
            </ui-card>
          }
        </div>
      }
    </div>
  `,
})
export class LoadingToLoadedListComponent {
    protected readonly placeholders: readonly number[] = [1, 2];
    protected readonly loading = signal(false);
    protected readonly projects = signal<readonly Project[]>([]);

    protected readonly isEmpty = computed(() => this.projects().length === 0);

    protected load(): void {
        this.loading.set(true);
        this.projects.set([
            { id: 'a', name: 'Design system', status: 'Active' },
            { id: 'b', name: 'Billing rewrite', status: 'Paused' },
        ]);
        this.loading.set(false);
    }

    protected loadEmpty(): void {
        this.loading.set(true);
        this.projects.set([]);
        this.loading.set(false);
    }
}
