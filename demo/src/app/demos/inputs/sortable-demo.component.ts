import { Component, ChangeDetectionStrategy, computed, effect, inject, signal } from '@angular/core';
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
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { SORTABLE_DEMO_LOCALES } from './sortable-demo.locales';

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
                <h2 id="sortable" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
                <p class="text-muted-foreground mt-1">{{ t().description }}</p>
            </div>

            <!-- Vertical list -->
            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().verticalHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().verticalDescription }}</p>
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
                                    <span class="text-xs text-green-600 dark:text-green-400 font-medium shrink-0">{{ t().doneLabel }}</span>
                                }
                            </ui-sortable-item>
                        </ng-template>
                    </ui-sortable>
                </div>
            </div>

            <!-- Horizontal list -->
            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().horizontalHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().horizontalDescription }}</p>
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
                <h3 class="text-lg font-medium">{{ t().handleHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().handleDescription }}</p>
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
                <h3 class="text-lg font-medium">{{ t().crossListHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().crossListDescription }}</p>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div class="space-y-2">
                        <h4 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{{ t().todoLabel }}</h4>
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
                        <h4 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{{ t().doingLabel }}</h4>
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
                        <h4 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{{ t().doneBoardLabel }}</h4>
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
                <h3 class="text-lg font-medium">{{ t().acceptsHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().acceptsDescription }}</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="space-y-2">
                        <h4 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{{ t().inboxLabel }}</h4>
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
                        <h4 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{{ t().triagedLabel }}</h4>
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
                <h3 class="text-lg font-medium">{{ t().positionHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().positionDescription }}</p>
                <div class="space-y-1 max-w-sm">
                    <ui-sortable [(items)]="ranked" [positionClass]="posFn" [landEffect]="flashFx">
                        <ng-template uiSortableItem let-item let-i="index">
                            <ui-sortable-item [index]="i" class="border rounded-md px-3 py-2 w-full transition-colors duration-200">
                                <span class="flex-1 text-sm">{{ $any(item).name }}</span>
                            </ui-sortable-item>
                        </ng-template>
                    </ui-sortable>
                </div>
            </div>

            <!-- All four land effects side by side -->
            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().landEffectsHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().landEffectsDescription }}</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div class="space-y-2">
                        <h4 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{{ t().flashLabel }}</h4>
                        <ui-sortable [(items)]="flashList" [landEffect]="flashFx" class="gap-1">
                            <ng-template uiSortableItem let-item let-i="index">
                                <ui-sortable-item [index]="i" class="bg-card border rounded px-2 py-1.5 text-xs w-full">{{ $any(item).name }}</ui-sortable-item>
                            </ng-template>
                        </ui-sortable>
                    </div>
                    <div class="space-y-2">
                        <h4 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{{ t().pulseLabel }}</h4>
                        <ui-sortable [(items)]="pulseList" [landEffect]="pulseFx" class="gap-1">
                            <ng-template uiSortableItem let-item let-i="index">
                                <ui-sortable-item [index]="i" class="bg-card border rounded px-2 py-1.5 text-xs w-full">{{ $any(item).name }}</ui-sortable-item>
                            </ng-template>
                        </ui-sortable>
                    </div>
                    <div class="space-y-2">
                        <h4 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{{ t().shakeLabel }}</h4>
                        <ui-sortable [(items)]="shakeList" [landEffect]="shakeFx" class="gap-1">
                            <ng-template uiSortableItem let-item let-i="index">
                                <ui-sortable-item [index]="i" class="bg-card border rounded px-2 py-1.5 text-xs w-full">{{ $any(item).name }}</ui-sortable-item>
                            </ng-template>
                        </ui-sortable>
                    </div>
                    <div class="space-y-2">
                        <h4 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{{ t().glowLabel }}</h4>
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
                <h3 class="text-lg font-medium">{{ t().ghostHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().ghostDescription }}</p>
                <div class="space-y-1 max-w-sm">
                    <ui-sortable [(items)]="customGhostItems">
                        <ng-template uiSortableItem let-item let-i="index">
                            <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full">
                                <span class="flex-1 text-sm">{{ $any(item).name }}</span>
                            </ui-sortable-item>
                        </ng-template>
                        <ng-template uiSortableGhost>
                            <div class="rounded-md border-2 border-primary bg-primary/10 px-3 py-2 text-sm text-primary font-medium my-0.5">
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
                <h3 class="text-lg font-medium">{{ t().slotsHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().slotsDescription }}</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="border rounded-md bg-muted/30 flex flex-col">
                        <ui-sortable [(items)]="kanbanBacklog" group="slots" class="gap-2 p-3 flex-1 min-h-40">
                            <div uiSortableHeader class="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{{ t().backlogLabel }}</div>
                            <div uiSortableEmpty class="text-sm text-muted-foreground italic py-6 text-center">{{ t().dropHereLabel }}</div>
                            <ng-template uiSortableItem let-card let-i="index">
                                <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full">{{ $any(card).name }}</ui-sortable-item>
                            </ng-template>
                            <button uiSortableFooter type="button" class="text-xs text-muted-foreground hover:text-foreground mt-2 text-left">{{ t().addCardLabel }}</button>
                        </ui-sortable>
                    </div>
                    <div class="border rounded-md bg-muted/30 flex flex-col">
                        <ui-sortable [(items)]="kanbanArchive" group="slots" class="gap-2 p-3 flex-1 min-h-40">
                            <div uiSortableHeader class="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{{ t().archiveLabel }}</div>
                            <div uiSortableEmpty class="text-sm text-muted-foreground italic py-6 text-center">{{ t().emptyDropLabel }}</div>
                            <ng-template uiSortableItem let-card let-i="index">
                                <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full">{{ $any(card).name }}</ui-sortable-item>
                            </ng-template>
                            <button uiSortableFooter type="button" class="text-xs text-muted-foreground hover:text-foreground mt-2 text-left">{{ t().addCardLabel }}</button>
                        </ui-sortable>
                    </div>
                </div>
            </div>

            <!-- Localized announcements -->
            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().localizedHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().localizedDescription }}</p>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div class="space-y-2">
                        <h4 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{{ t().englishLabel }}</h4>
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
                <h3 class="text-lg font-medium">{{ t().disabledHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().disabledDescription }}</p>
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
                <h3 class="text-lg font-medium">{{ t().liveStateHeading }}</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="space-y-1">
                        <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">{{ t().taskOrderLabel }}</p>
                        <pre class="bg-muted rounded-md p-3 text-xs overflow-auto max-h-48">{{ tasksJson() }}</pre>
                    </div>
                    <div class="space-y-1">
                        <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">{{ t().lastEventLabel }}</p>
                        <pre class="bg-muted rounded-md p-3 text-xs overflow-auto max-h-48">{{ lastEventJson() }}</pre>
                    </div>
                </div>
                @if (lastReject(); as r) {
                    <div class="space-y-1">
                        <p class="text-xs font-medium text-destructive uppercase tracking-wide">{{ t().lastRejectLabel }}</p>
                        <pre class="bg-destructive/10 text-destructive rounded-md p-3 text-xs">{{ rejectJson() }}</pre>
                    </div>
                }
            </div>

        </section>
    `,
})
export class SortableDemoComponent {
    private readonly localeId = inject(UI_LOCALE_ID);
    protected readonly t = computed(() => SORTABLE_DEMO_LOCALES[this.localeId()] ?? SORTABLE_DEMO_LOCALES['en']);

    readonly tasks = signal<Task[]>([]);
    readonly phases = signal<Phase[]>([]);
    readonly handleTasks = signal<Task[]>([]);
    readonly disabledItems = signal<Task[]>([]);
    readonly todo = signal<Card[]>([]);
    readonly doing = signal<Card[]>([]);
    readonly done = signal<Card[]>([]);
    readonly inbox = signal<Card[]>([]);
    readonly triaged = signal<Card[]>([]);
    readonly ranked = signal<Card[]>([]);
    readonly kanbanBacklog = signal<Card[]>([]);
    readonly kanbanArchive = signal<Card[]>([]);

    readonly flashList = signal<Card[]>([{ id: 400, name: 'flash 1' }, { id: 401, name: 'flash 2' }, { id: 402, name: 'flash 3' }]);
    readonly pulseList = signal<Card[]>([{ id: 410, name: 'pulse 1' }, { id: 411, name: 'pulse 2' }, { id: 412, name: 'pulse 3' }]);
    readonly shakeList = signal<Card[]>([{ id: 420, name: 'shake 1' }, { id: 421, name: 'shake 2' }, { id: 422, name: 'shake 3' }]);
    readonly glowList = signal<Card[]>([{ id: 430, name: 'glow 1' }, { id: 431, name: 'glow 2' }, { id: 432, name: 'glow 3' }]);
    readonly customGhostItems = signal<Card[]>([
        { id: 500, name: 'Custom-rendered card 1' },
        { id: 501, name: 'Custom-rendered card 2' },
        { id: 502, name: 'Custom-rendered card 3' },
    ]);

    readonly localeEn = signal<Card[]>([{ id: 700, name: 'English item' }, { id: 701, name: 'Another' }]);
    readonly localeHe = signal<Card[]>([{ id: 710, name: 'פריט בעברית' }, { id: 711, name: 'פריט נוסף' }]);
    readonly localeDe = signal<Card[]>([{ id: 720, name: 'Deutsches Element' }, { id: 721, name: 'Noch eines' }]);

    constructor() {
        effect(() => {
            const loc = this.t();
            this.tasks.set([
                { id: 1, name: loc.taskAudit, done: true },
                { id: 2, name: loc.taskDesignTokens, done: false },
                { id: 3, name: loc.taskBuildSortable, done: false },
                { id: 4, name: loc.taskWriteTests, done: false },
                { id: 5, name: loc.taskUpdateDocs, done: false },
            ]);
            this.phases.set([
                { id: 1, label: loc.phaseBacklog, color: '#6366f1' },
                { id: 2, label: loc.phaseInProgress, color: '#f59e0b' },
                { id: 3, label: loc.phaseReview, color: '#3b82f6' },
                { id: 4, label: loc.phaseDone, color: '#10b981' },
            ]);
            this.handleTasks.set([
                { id: 10, name: loc.handleTaskResponsive, done: false },
                { id: 11, name: loc.handleTaskTouch, done: false },
                { id: 12, name: loc.handleTaskKeyboard, done: false },
                { id: 13, name: loc.handleTaskAria, done: false },
            ]);
            this.disabledItems.set([
                { id: 20, name: loc.lockedA, done: false },
                { id: 21, name: loc.lockedB, done: false },
                { id: 22, name: loc.lockedC, done: false },
            ]);
            this.todo.set([
                { id: 100, name: loc.todoDraftRfc },
                { id: 101, name: loc.todoOutlineSections },
                { id: 102, name: loc.todoCollectFeedback },
            ]);
            this.doing.set([{ id: 110, name: loc.doingWireAuth }]);
            this.done.set([
                { id: 120, name: loc.doneSetupRepo },
                { id: 121, name: loc.donePinDeps },
            ]);
            this.inbox.set([
                { id: 200, name: loc.inboxBugReport },
                { id: 201, name: loc.inboxFeatureRequest },
                { id: 202, name: loc.inboxTriagedTicket },
            ]);
            this.triaged.set([{ id: 210, name: loc.triagedEarlier }]);
            this.ranked.set([
                { id: 300, name: loc.highestPriority },
                { id: 301, name: loc.middleItemA },
                { id: 302, name: loc.middleItemB },
                { id: 303, name: loc.lowestPriority },
            ]);
            this.kanbanBacklog.set([
                { id: 600, name: loc.kanbanA11y },
                { id: 601, name: loc.kanbanI18n },
            ]);
        });
    }

    readonly wipLimit = (_item: Card, ctx: { toIndex: number }): { ok: boolean; reason?: string } => {
        return ctx.toIndex < 2
            ? { ok: true }
            : { ok: false, reason: 'WIP limit reached (2)' };
    };

    readonly posFn = (_item: Card, i: number, total: number): string => {
        if (i === 0) return 'bg-green-100 dark:bg-green-900/40 border-green-300';
        if (i === total - 1) return 'bg-red-100 dark:bg-red-900/40 border-red-300';
        return 'bg-card';
    };

    readonly flashFx = (): string => SORTABLE_LAND_EFFECTS.flash;
    readonly pulseFx = (): string => SORTABLE_LAND_EFFECTS.pulse;
    readonly shakeFx = (): string => SORTABLE_LAND_EFFECTS.shake;
    readonly glowFx = (): string => SORTABLE_LAND_EFFECTS.glow;

    private readonly lastEvent = signal<SortableReorderEvent<unknown> | null>(null);
    readonly lastReject = signal<SortableDropRejectedEvent<unknown> | null>(null);

    tasksJson(): string {
        return JSON.stringify(this.tasks().map((task, i) => ({ position: i + 1, name: task.name })), null, 2);
    }

    lastEventJson(): string {
        const ev = this.lastEvent();
        if (!ev) return this.t().noReorderYet;
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
