import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import {
    SortableComponent,
    SortableItemComponent,
    SortableItemTemplateDirective,
    SortableHandleDirective,
    SortableReorderEvent,
    SortableDropRejectedEvent,
    SORTABLE_LAND_EFFECTS,
} from '../../../../../packages/components/ui';
import { SortableGhostTemplateDirective } from '../../../../../packages/components/ui/sortable/sub/sortable-ghost.directive';
import { SortablePlaceholderTemplateDirective } from '../../../../../packages/components/ui/sortable/sub/sortable-placeholder.directive';

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

interface Card {
    id: number;
    name: string;
}

@Component({
    selector: 'app-sortable-demo',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        SortableComponent,
        SortableItemComponent,
        SortableItemTemplateDirective,
        SortableHandleDirective,
        SortableGhostTemplateDirective,
        SortablePlaceholderTemplateDirective,
    ],
    template: `
        <section class="space-y-12 max-w-4xl">

            <!-- Header -->
            <div>
                <h2 id="sortable" class="text-2xl font-semibold scroll-m-20">Sortable</h2>
                <p class="text-muted-foreground mt-1">
                    A generic drag-to-reorder list with cross-list drag, accept gates, animated neighbors,
                    customizable ghost + placeholder slots, and full keyboard parity. Pointer (mouse + touch)
                    and keyboard supported; respects <code class="font-mono text-xs bg-muted px-1 py-0.5 rounded">prefers-reduced-motion</code>.
                </p>
            </div>

            <!-- Vertical list -->
            <div class="space-y-3">
                <h3 class="text-lg font-medium">Vertical list</h3>
                <p class="text-sm text-muted-foreground">Drag rows up and down. Neighbor items slide via FLIP; the lifted card scales/tilts (Trello-style).</p>
                <div class="space-y-1 max-w-sm">
                    <ui-sortable [(items)]="tasks" (reorder)="onTaskReorder($event)">
                        <ng-template uiSortableItem let-task let-i="index">
                            <ui-sortable-item
                                [index]="i"
                                class="bg-card border rounded-md px-3 py-2.5 w-full gap-3 hover:bg-accent/40 transition-colors"
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
                <h3 class="text-lg font-medium">Horizontal list</h3>
                <p class="text-sm text-muted-foreground">Drag phase cards left and right.</p>
                <ui-sortable [(items)]="phases" orientation="horizontal" class="gap-2 flex-wrap" (reorder)="onPhaseReorder($event)">
                    <ng-template uiSortableItem let-phase let-i="index">
                        <ui-sortable-item
                            [index]="i"
                            class="rounded-lg px-4 py-2.5 text-sm font-medium text-white shrink-0 shadow-sm"
                            [style]="{ 'background-color': $any(phase).color }"
                        >
                            {{ $any(phase).label }}
                        </ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            </div>

            <!-- Handle-only -->
            <div class="space-y-3">
                <h3 class="text-lg font-medium">Handle-only mode</h3>
                <p class="text-sm text-muted-foreground">Only the grip icon initiates a drag — the rest of the row is freely interactive.</p>
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

            <!-- Cross-list drag -->
            <div class="space-y-3">
                <h3 class="text-lg font-medium">Cross-list drag</h3>
                <p class="text-sm text-muted-foreground">
                    Lists that share a <code class="font-mono text-xs bg-muted px-1 py-0.5 rounded">[group]</code> string
                    accept each other's items. The receiving list highlights via
                    <code class="font-mono text-xs bg-muted px-1 py-0.5 rounded">data-[receiving=true]</code> while a foreign item is hovering.
                    Keyboard: Space to lift, Tab/Shift+Tab to hand off to the next/previous peer.
                </p>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div class="space-y-2">
                        <h4 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">To do</h4>
                        <ui-sortable
                            [(items)]="todo"
                            group="board"
                            listId="todo"
                            class="gap-2 min-h-32 p-2 border rounded-md bg-muted/30 data-[receiving=true]:bg-primary/10 data-[receiving=true]:border-primary"
                            (reorder)="onBoardReorder($event)">
                            <ng-template uiSortableItem let-card let-i="index">
                                <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full">
                                    <span class="flex-1 text-sm">{{ $any(card).name }}</span>
                                </ui-sortable-item>
                            </ng-template>
                        </ui-sortable>
                    </div>
                    <div class="space-y-2">
                        <h4 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Doing</h4>
                        <ui-sortable
                            [(items)]="doing"
                            group="board"
                            listId="doing"
                            class="gap-2 min-h-32 p-2 border rounded-md bg-muted/30 data-[receiving=true]:bg-primary/10 data-[receiving=true]:border-primary"
                            (reorder)="onBoardReorder($event)">
                            <ng-template uiSortableItem let-card let-i="index">
                                <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full">
                                    <span class="flex-1 text-sm">{{ $any(card).name }}</span>
                                </ui-sortable-item>
                            </ng-template>
                        </ui-sortable>
                    </div>
                    <div class="space-y-2">
                        <h4 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Done</h4>
                        <ui-sortable
                            [(items)]="done"
                            group="board"
                            listId="done"
                            class="gap-2 min-h-32 p-2 border rounded-md bg-muted/30 data-[receiving=true]:bg-primary/10 data-[receiving=true]:border-primary"
                            (reorder)="onBoardReorder($event)">
                            <ng-template uiSortableItem let-card let-i="index">
                                <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full">
                                    <span class="flex-1 text-sm">{{ $any(card).name }}</span>
                                </ui-sortable-item>
                            </ng-template>
                        </ui-sortable>
                    </div>
                </div>
            </div>

            <!-- Accepts predicate -->
            <div class="space-y-3">
                <h3 class="text-lg font-medium">Accepts predicate (WIP limit)</h3>
                <p class="text-sm text-muted-foreground">
                    The receiving list returns <code class="font-mono text-xs bg-muted px-1 py-0.5 rounded">{{ '{ ok: false, reason }' }}</code>
                    when its WIP limit is hit. The visual reject feedback (red border) is driven by
                    <code class="font-mono text-xs bg-muted px-1 py-0.5 rounded">data-[reject]</code>.
                </p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="space-y-2">
                        <h4 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Inbox</h4>
                        <ui-sortable
                            [(items)]="inbox"
                            group="triage"
                            listId="inbox"
                            class="gap-2 min-h-32 p-2 border rounded-md bg-muted/30">
                            <ng-template uiSortableItem let-card let-i="index">
                                <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full">{{ $any(card).name }}</ui-sortable-item>
                            </ng-template>
                        </ui-sortable>
                    </div>
                    <div class="space-y-2">
                        <h4 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Triaged (max 2)</h4>
                        <ui-sortable
                            [(items)]="triaged"
                            group="triage"
                            listId="triaged"
                            [accepts]="wipLimit"
                            (dropRejected)="onReject($event)"
                            class="gap-2 min-h-32 p-2 border rounded-md bg-muted/30 data-[reject]:border-destructive data-[reject]:bg-destructive/10">
                            <ng-template uiSortableItem let-card let-i="index">
                                <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full">{{ $any(card).name }}</ui-sortable-item>
                            </ng-template>
                        </ui-sortable>
                    </div>
                </div>
            </div>

            <!-- Position class + land effects -->
            <div class="space-y-3">
                <h3 class="text-lg font-medium">Position class + land effects</h3>
                <p class="text-sm text-muted-foreground">
                    <code class="font-mono text-xs bg-muted px-1 py-0.5 rounded">[positionClass]</code> assigns a persistent class
                    based on each item's index (first row stays green, last stays red, middle is neutral).
                    <code class="font-mono text-xs bg-muted px-1 py-0.5 rounded">[landEffect]</code> adds a transient
                    <code class="font-mono text-xs bg-muted px-1 py-0.5 rounded">flash</code> keyframe to whichever
                    item just landed.
                </p>
                <style>
                    .is-first { background-color: rgb(187 247 208) !important; transition: background-color 200ms; }
                    .is-last  { background-color: rgb(254 202 202) !important; transition: background-color 200ms; }
                    .is-middle { transition: background-color 200ms; }
                </style>
                <div class="space-y-1 max-w-sm">
                    <ui-sortable [(items)]="ranked" [positionClass]="posFn" [landEffect]="flashFx">
                        <ng-template uiSortableItem let-item let-i="index">
                            <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full">
                                <span class="flex-1 text-sm">{{ $any(item).name }}</span>
                            </ui-sortable-item>
                        </ng-template>
                    </ui-sortable>
                </div>
            </div>

            <!-- All four land effects side by side -->
            <div class="space-y-3">
                <h3 class="text-lg font-medium">Built-in land effects</h3>
                <p class="text-sm text-muted-foreground">
                    Plug a <code class="font-mono text-xs bg-muted px-1 py-0.5 rounded">SORTABLE_LAND_EFFECTS</code> constant
                    into <code class="font-mono text-xs bg-muted px-1 py-0.5 rounded">[landEffect]</code>, or return your own class name.
                    Reorder any list to see the matching one-shot animation.
                </p>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div class="space-y-2">
                        <h4 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Flash</h4>
                        <ui-sortable [(items)]="flashList" [landEffect]="flashFx" class="gap-1">
                            <ng-template uiSortableItem let-item let-i="index">
                                <ui-sortable-item [index]="i" class="bg-card border rounded px-2 py-1.5 text-xs w-full">{{ $any(item).name }}</ui-sortable-item>
                            </ng-template>
                        </ui-sortable>
                    </div>
                    <div class="space-y-2">
                        <h4 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Pulse</h4>
                        <ui-sortable [(items)]="pulseList" [landEffect]="pulseFx" class="gap-1">
                            <ng-template uiSortableItem let-item let-i="index">
                                <ui-sortable-item [index]="i" class="bg-card border rounded px-2 py-1.5 text-xs w-full">{{ $any(item).name }}</ui-sortable-item>
                            </ng-template>
                        </ui-sortable>
                    </div>
                    <div class="space-y-2">
                        <h4 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Shake</h4>
                        <ui-sortable [(items)]="shakeList" [landEffect]="shakeFx" class="gap-1">
                            <ng-template uiSortableItem let-item let-i="index">
                                <ui-sortable-item [index]="i" class="bg-card border rounded px-2 py-1.5 text-xs w-full">{{ $any(item).name }}</ui-sortable-item>
                            </ng-template>
                        </ui-sortable>
                    </div>
                    <div class="space-y-2">
                        <h4 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Glow</h4>
                        <ui-sortable [(items)]="glowList" [landEffect]="glowFx" class="gap-1">
                            <ng-template uiSortableItem let-item let-i="index">
                                <ui-sortable-item [index]="i" class="bg-card border rounded px-2 py-1.5 text-xs w-full">{{ $any(item).name }}</ui-sortable-item>
                            </ng-template>
                        </ui-sortable>
                    </div>
                </div>
            </div>

            <!-- Custom ghost + placeholder -->
            <div class="space-y-3">
                <h3 class="text-lg font-medium">Custom ghost + placeholder</h3>
                <p class="text-sm text-muted-foreground">
                    Project an <code class="font-mono text-xs bg-muted px-1 py-0.5 rounded">&lt;ng-template uiSortableGhost&gt;</code>
                    for the projected drop preview and
                    <code class="font-mono text-xs bg-muted px-1 py-0.5 rounded">&lt;ng-template uiSortablePlaceholder&gt;</code>
                    for the lift-origin silhouette. Drag a row to see them both.
                </p>
                <div class="space-y-1 max-w-sm">
                    <ui-sortable [(items)]="customGhostItems">
                        <ng-template uiSortableItem let-item let-i="index">
                            <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full">
                                <span class="flex-1 text-sm">{{ $any(item).name }}</span>
                            </ui-sortable-item>
                        </ng-template>
                        <ng-template uiSortableGhost>
                            <div class="rounded-md border-2 border-primary bg-primary/10 px-3 py-2 text-sm text-primary font-medium">
                                Drop here →
                            </div>
                        </ng-template>
                        <ng-template uiSortablePlaceholder>
                            <div class="rounded-md border-2 border-dashed border-muted-foreground/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground italic">
                                (was here)
                            </div>
                        </ng-template>
                    </ui-sortable>
                </div>
            </div>

            <!-- Header / footer / empty slots -->
            <div class="space-y-3">
                <h3 class="text-lg font-medium">Header / footer / empty slots</h3>
                <p class="text-sm text-muted-foreground">
                    The <code class="font-mono text-xs bg-muted px-1 py-0.5 rounded">[uiSortableHeader]</code>,
                    <code class="font-mono text-xs bg-muted px-1 py-0.5 rounded">[uiSortableFooter]</code>,
                    and <code class="font-mono text-xs bg-muted px-1 py-0.5 rounded">[uiSortableEmpty]</code>
                    attribute selectors mount auxiliary UI inside the sortable container. Empty renders only when items is empty.
                </p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="border rounded-md bg-muted/30 flex flex-col">
                        <ui-sortable [(items)]="kanbanBacklog" group="slots" class="gap-2 p-3 flex-1 min-h-40">
                            <div uiSortableHeader class="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Backlog</div>
                            <div uiSortableEmpty class="text-sm text-muted-foreground italic py-6 text-center">Drop cards here</div>
                            <ng-template uiSortableItem let-card let-i="index">
                                <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full">{{ $any(card).name }}</ui-sortable-item>
                            </ng-template>
                            <button uiSortableFooter type="button" class="text-xs text-muted-foreground hover:text-foreground mt-2 text-left">+ Add card</button>
                        </ui-sortable>
                    </div>
                    <div class="border rounded-md bg-muted/30 flex flex-col">
                        <ui-sortable [(items)]="kanbanArchive" group="slots" class="gap-2 p-3 flex-1 min-h-40">
                            <div uiSortableHeader class="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Archive</div>
                            <div uiSortableEmpty class="text-sm text-muted-foreground italic py-6 text-center">Drop cards here</div>
                            <ng-template uiSortableItem let-card let-i="index">
                                <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full">{{ $any(card).name }}</ui-sortable-item>
                            </ng-template>
                            <button uiSortableFooter type="button" class="text-xs text-muted-foreground hover:text-foreground mt-2 text-left">+ Add card</button>
                        </ui-sortable>
                    </div>
                </div>
            </div>

            <!-- Localized announcements -->
            <div class="space-y-3">
                <h3 class="text-lg font-medium">Localized announcements</h3>
                <p class="text-sm text-muted-foreground">
                    <code class="font-mono text-xs bg-muted px-1 py-0.5 rounded">[locale]</code> selects the message set
                    used for screen-reader announcements. Lift an item with Space/Enter to hear the difference
                    (or inspect <code class="font-mono text-xs bg-muted px-1 py-0.5 rounded">[data-slot="sortable-aria-live"]</code> in the DOM).
                </p>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div class="space-y-2">
                        <h4 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">English</h4>
                        <ui-sortable [(items)]="localeEn" locale="en">
                            <ng-template uiSortableItem let-item let-i="index">
                                <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full text-sm">{{ $any(item).name }}</ui-sortable-item>
                            </ng-template>
                        </ui-sortable>
                    </div>
                    <div class="space-y-2" dir="rtl">
                        <h4 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">עברית</h4>
                        <ui-sortable [(items)]="localeHe" locale="he">
                            <ng-template uiSortableItem let-item let-i="index">
                                <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full text-sm">{{ $any(item).name }}</ui-sortable-item>
                            </ng-template>
                        </ui-sortable>
                    </div>
                    <div class="space-y-2">
                        <h4 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Deutsch</h4>
                        <ui-sortable [(items)]="localeDe" locale="de">
                            <ng-template uiSortableItem let-item let-i="index">
                                <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full text-sm">{{ $any(item).name }}</ui-sortable-item>
                            </ng-template>
                        </ui-sortable>
                    </div>
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
                <h3 class="text-lg font-medium">Live state</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="space-y-1">
                        <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current task order</p>
                        <pre class="bg-muted rounded-md p-3 text-xs overflow-auto max-h-48">{{ tasksJson() }}</pre>
                    </div>
                    <div class="space-y-1">
                        <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last reorder event</p>
                        <pre class="bg-muted rounded-md p-3 text-xs overflow-auto max-h-48">{{ lastEventJson() }}</pre>
                    </div>
                </div>
                @if (lastReject(); as r) {
                    <div class="space-y-1">
                        <p class="text-xs font-medium text-destructive uppercase tracking-wide">Last rejected drop</p>
                        <pre class="bg-destructive/10 text-destructive rounded-md p-3 text-xs">{{ rejectJson() }}</pre>
                    </div>
                }
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

    readonly todo = signal<Card[]>([
        { id: 100, name: 'Draft RFC' },
        { id: 101, name: 'Outline sections' },
        { id: 102, name: 'Collect feedback' },
    ]);
    readonly doing = signal<Card[]>([{ id: 110, name: 'Wire up auth flow' }]);
    readonly done = signal<Card[]>([
        { id: 120, name: 'Set up repo' },
        { id: 121, name: 'Pin dependencies' },
    ]);

    readonly inbox = signal<Card[]>([
        { id: 200, name: 'Bug report #143' },
        { id: 201, name: 'Feature request #92' },
        { id: 202, name: 'Triaged ticket #11' },
    ]);
    readonly triaged = signal<Card[]>([{ id: 210, name: 'Triaged earlier' }]);
    readonly wipLimit = (_item: Card, ctx: { toIndex: number }): { ok: boolean; reason?: string } => {
        return ctx.toIndex < 2
            ? { ok: true }
            : { ok: false, reason: 'WIP limit reached (2)' };
    };

    readonly ranked = signal<Card[]>([
        { id: 300, name: 'Highest priority' },
        { id: 301, name: 'Middle item A' },
        { id: 302, name: 'Middle item B' },
        { id: 303, name: 'Lowest priority' },
    ]);
    readonly posFn = (_item: Card, i: number, total: number): string => {
        if (i === 0) return 'is-first';
        if (i === total - 1) return 'is-last';
        return 'is-middle';
    };

    readonly flashList = signal<Card[]>([{ id: 400, name: 'flash 1' }, { id: 401, name: 'flash 2' }, { id: 402, name: 'flash 3' }]);
    readonly pulseList = signal<Card[]>([{ id: 410, name: 'pulse 1' }, { id: 411, name: 'pulse 2' }, { id: 412, name: 'pulse 3' }]);
    readonly shakeList = signal<Card[]>([{ id: 420, name: 'shake 1' }, { id: 421, name: 'shake 2' }, { id: 422, name: 'shake 3' }]);
    readonly glowList = signal<Card[]>([{ id: 430, name: 'glow 1' }, { id: 431, name: 'glow 2' }, { id: 432, name: 'glow 3' }]);
    readonly flashFx = (): string => SORTABLE_LAND_EFFECTS.flash;
    readonly pulseFx = (): string => SORTABLE_LAND_EFFECTS.pulse;
    readonly shakeFx = (): string => SORTABLE_LAND_EFFECTS.shake;
    readonly glowFx = (): string => SORTABLE_LAND_EFFECTS.glow;

    readonly customGhostItems = signal<Card[]>([
        { id: 500, name: 'Custom-rendered card 1' },
        { id: 501, name: 'Custom-rendered card 2' },
        { id: 502, name: 'Custom-rendered card 3' },
    ]);

    readonly kanbanBacklog = signal<Card[]>([
        { id: 600, name: 'A11y audit' },
        { id: 601, name: 'i18n rewrite' },
    ]);
    readonly kanbanArchive = signal<Card[]>([]);

    readonly localeEn = signal<Card[]>([{ id: 700, name: 'English item' }, { id: 701, name: 'Another' }]);
    readonly localeHe = signal<Card[]>([{ id: 710, name: 'פריט בעברית' }, { id: 711, name: 'פריט נוסף' }]);
    readonly localeDe = signal<Card[]>([{ id: 720, name: 'Deutsches Element' }, { id: 721, name: 'Noch eines' }]);

    private readonly lastEvent = signal<SortableReorderEvent<unknown> | null>(null);
    readonly lastReject = signal<SortableDropRejectedEvent<unknown> | null>(null);

    tasksJson(): string {
        return JSON.stringify(this.tasks().map((t, i) => ({ position: i + 1, name: t.name })), null, 2);
    }

    lastEventJson(): string {
        const ev = this.lastEvent();
        if (!ev) return 'No reorder yet';
        return JSON.stringify(ev, null, 2);
    }

    rejectJson(): string {
        const ev = this.lastReject();
        if (!ev) return 'None';
        return JSON.stringify(ev, null, 2);
    }

    onTaskReorder(event: SortableReorderEvent<Task>): void {
        this.lastEvent.set(event);
    }

    onPhaseReorder(event: SortableReorderEvent<Phase>): void {
        this.lastEvent.set(event);
    }

    onHandleReorder(event: SortableReorderEvent<Task>): void {
        this.lastEvent.set(event);
    }

    onBoardReorder(event: SortableReorderEvent<Card>): void {
        this.lastEvent.set(event);
    }

    onReject(event: SortableDropRejectedEvent<Card>): void {
        this.lastReject.set(event);
    }
}
