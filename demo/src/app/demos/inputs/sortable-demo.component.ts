import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import {
    SortableComponent,
    SortableItemComponent,
    SortableItemTemplateDirective,
    SortableHandleDirective,
    SortableReorderEvent,
} from '../../../../../packages/components/ui';

interface Task {
    id: number;
    name: string;
    done: boolean;
}

interface Phase {
    id: number;
    label: string;
    color: string;
}

@Component({
    selector: 'app-sortable-demo',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        SortableComponent,
        SortableItemComponent,
        SortableItemTemplateDirective,
        SortableHandleDirective,
    ],
    template: `
        <section class="space-y-12 max-w-2xl">

            <!-- Header -->
            <div>
                <h2 id="sortable" class="text-2xl font-semibold scroll-m-20">Sortable</h2>
                <p class="text-muted-foreground mt-1">
                    A generic drag-to-reorder list. Pass any data array and provide a row template.
                    Supports pointer (mouse + touch) and keyboard (Space/Enter to lift, Arrow keys to move, Escape to cancel).
                </p>
            </div>

            <!-- Vertical list -->
            <div class="space-y-3">
                <h3 class="text-lg font-medium">Vertical List</h3>
                <p class="text-sm text-muted-foreground">Drag rows up and down to reorder tasks.</p>
                <div class="space-y-1 max-w-sm">
                    <ui-sortable [(items)]="tasks" (reorder)="onTaskReorder($event)">
                        <ng-template uiSortableItem let-task let-i="index">
                            <ui-sortable-item
                                [index]="i"
                                class="bg-card border rounded-md px-3 py-2.5 w-full gap-3 cursor-grab active:cursor-grabbing hover:bg-accent/40 transition-colors"
                            >
                                <span class="text-muted-foreground text-xs w-5 shrink-0 text-right tabular-nums">{{ i + 1 }}</span>
                                <span
                                    class="flex-1 text-sm"
                                    [class.line-through]="$any(task).done"
                                    [class.text-muted-foreground]="$any(task).done"
                                >{{ $any(task).name }}</span>
                                @if ($any(task).done) {
                                    <span class="text-xs text-green-600 dark:text-green-400 font-medium shrink-0">Done</span>
                                }
                            </ui-sortable-item>
                        </ng-template>
                    </ui-sortable>
                </div>
            </div>

            <!-- Horizontal list -->
            <div class="space-y-3">
                <h3 class="text-lg font-medium">Horizontal List</h3>
                <p class="text-sm text-muted-foreground">Drag phase cards left and right.</p>
                <ui-sortable [(items)]="phases" orientation="horizontal" class="gap-2 flex-wrap" (reorder)="onPhaseReorder($event)">
                    <ng-template uiSortableItem let-phase let-i="index">
                        <ui-sortable-item
                            [index]="i"
                            class="rounded-lg px-4 py-2.5 text-sm font-medium text-white cursor-grab active:cursor-grabbing shrink-0 shadow-sm"
                            [style]="{ 'background-color': $any(phase).color }"
                        >
                            {{ $any(phase).label }}
                        </ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            </div>

            <!-- Handle-only mode -->
            <div class="space-y-3">
                <h3 class="text-lg font-medium">Handle-Only Mode</h3>
                <p class="text-sm text-muted-foreground">
                    Only the grip icon initiates a drag — the rest of the row is freely interactive.
                </p>
                <div class="space-y-1 max-w-sm">
                    <ui-sortable [(items)]="handleTasks" [handleOnly]="true" (reorder)="onHandleReorder($event)">
                        <ng-template uiSortableItem let-task let-i="index">
                            <ui-sortable-item
                                [index]="i"
                                class="bg-card border rounded-md px-3 py-2.5 w-full gap-2 hover:bg-accent/30 transition-colors"
                            >
                                <span
                                    uiSortableHandle
                                    class="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing transition-colors shrink-0 touch-none text-base leading-none"
                                    title="Drag to reorder"
                                    aria-label="Drag handle"
                                >⠿</span>
                                <span class="flex-1 text-sm">{{ $any(task).name }}</span>
                                <span class="text-xs text-muted-foreground shrink-0">#{{ i + 1 }}</span>
                            </ui-sortable-item>
                        </ng-template>
                    </ui-sortable>
                </div>
            </div>

            <!-- Disabled -->
            <div class="space-y-3">
                <h3 class="text-lg font-medium">Disabled</h3>
                <p class="text-sm text-muted-foreground">When <code class="font-mono text-xs bg-muted px-1 py-0.5 rounded">disabled</code> is true, drag and keyboard interactions are prevented.</p>
                <div class="space-y-1 max-w-sm">
                    <ui-sortable [(items)]="disabledItems" [disabled]="true">
                        <ng-template uiSortableItem let-item let-i="index">
                            <ui-sortable-item
                                [index]="i"
                                class="bg-muted/50 border border-dashed rounded-md px-3 py-2.5 w-full gap-3 cursor-not-allowed opacity-70"
                            >
                                <span class="text-muted-foreground text-xs w-5 shrink-0 text-right">{{ i + 1 }}</span>
                                <span class="flex-1 text-sm text-muted-foreground">{{ $any(item).name }}</span>
                            </ui-sortable-item>
                        </ng-template>
                    </ui-sortable>
                </div>
            </div>

            <!-- Live state readout -->
            <div class="space-y-3">
                <h3 class="text-lg font-medium">Live State</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="space-y-1">
                        <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current task order</p>
                        <pre class="bg-muted rounded-md p-3 text-xs overflow-auto max-h-48">{{ tasksJson() }}</pre>
                    </div>
                    <div class="space-y-1">
                        <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last reorder event</p>
                        <pre class="bg-muted rounded-md p-3 text-xs">{{ lastEventJson() }}</pre>
                    </div>
                </div>
            </div>

        </section>
    `,
})
export class SortableDemoComponent {
    readonly tasks = signal<Task[]>([
        { id: 1, name: 'Audit existing components', done: true },
        { id: 2, name: 'Design token alignment', done: false },
        { id: 3, name: 'Build sortable list', done: false },
        { id: 4, name: 'Write unit tests', done: false },
        { id: 5, name: 'Update documentation', done: false },
    ]);

    readonly phases = signal<Phase[]>([
        { id: 1, label: 'Backlog', color: '#6366f1' },
        { id: 2, label: 'In Progress', color: '#f59e0b' },
        { id: 3, label: 'Review', color: '#3b82f6' },
        { id: 4, label: 'Done', color: '#10b981' },
    ]);

    readonly handleTasks = signal<Task[]>([
        { id: 10, name: 'Responsive breakpoints', done: false },
        { id: 11, name: 'Touch support', done: false },
        { id: 12, name: 'Keyboard navigation', done: false },
        { id: 13, name: 'ARIA attributes', done: false },
    ]);

    readonly disabledItems = signal<Task[]>([
        { id: 20, name: 'Locked item A', done: false },
        { id: 21, name: 'Locked item B', done: false },
        { id: 22, name: 'Locked item C', done: false },
    ]);

    private readonly lastEvent = signal<SortableReorderEvent | null>(null);

    tasksJson(): string {
        return JSON.stringify(this.tasks().map((t, i) => ({ position: i + 1, name: t.name })), null, 2);
    }

    lastEventJson(): string {
        const ev = this.lastEvent();
        if (!ev) return 'No reorder yet';
        return JSON.stringify(ev, null, 2);
    }

    onTaskReorder(event: SortableReorderEvent): void {
        this.lastEvent.set(event);
    }

    onPhaseReorder(_event: SortableReorderEvent): void {
        this.lastEvent.set(_event);
    }

    onHandleReorder(_event: SortableReorderEvent): void {
        this.lastEvent.set(_event);
    }
}
