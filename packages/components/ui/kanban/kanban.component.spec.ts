import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    KanbanComponent,
    KanbanColumnComponent,
    KanbanCardComponent,
    KanbanColumnHeaderComponent,
    KanbanCardContentComponent,
    KanbanColumn,
    KanbanCard,
    KanbanCardAddEvent,
    KanbanColumnDeleteEvent,
    KanbanHistoryState,
} from '../kanban';

// Simple mode test host
@Component({
    template: `
        <ui-kanban
            [columns]="columns()"
            [cards]="cards()"
            [searchTerm]="searchTerm()"
            (cardsChange)="onCardsChange($event)"
            (cardMoved)="onCardMoved($event)"
            (cardAdded)="onCardAdded($event)"
            (cardUpdated)="onCardUpdated($event)"
            (cardDeleted)="onCardDeleted($event)"
            (columnAdded)="onColumnAdded($event)"
            (columnUpdated)="onColumnUpdated($event)"
            (columnDeleted)="onColumnDeleted($event)"
            (columnsChange)="onColumnsChange($event)"
            (historyChange)="onHistoryChange($event)"
        />
    `,
    imports: [KanbanComponent],
})
class KanbanSimpleTestHostComponent {
    columns = signal<KanbanColumn[]>([
        { id: 'todo', title: 'To Do', order: 0, wipLimit: 3 },
        { id: 'doing', title: 'In Progress', order: 1 },
        { id: 'done', title: 'Done', order: 2 },
    ]);

    cards = signal<KanbanCard[]>([
        { id: 'card-1', columnId: 'todo', title: 'Task 1', description: 'First task', order: 0, priority: 'high', labels: [{ text: 'Bug', color: '#ef4444' }] },
        { id: 'card-2', columnId: 'todo', title: 'Task 2', order: 1, priority: 'low' },
        { id: 'card-3', columnId: 'doing', title: 'Task 3', order: 0, priority: 'urgent', assignees: [{ name: 'Alice' }] },
    ]);

    searchTerm = signal('');
    cardsChanged: KanbanCard[] = [];
    columnsChanged: KanbanColumn[] = [];
    cardMovedEvent: unknown = null;
    cardAddedEvent: KanbanCardAddEvent | null = null;
    cardUpdatedEvent: KanbanCard | null = null;
    cardDeletedId: string | null = null;
    columnAddedEvent: unknown = null;
    columnUpdatedEvent: KanbanColumn | null = null;
    columnDeletedEvent: KanbanColumnDeleteEvent | null = null;
    historyState: KanbanHistoryState | null = null;

    onCardsChange(cards: KanbanCard[]) { this.cardsChanged = cards; this.cards.set(cards); }
    onColumnsChange(columns: KanbanColumn[]) { this.columnsChanged = columns; this.columns.set(columns); }
    onCardMoved(event: unknown) { this.cardMovedEvent = event; }
    onCardAdded(event: KanbanCardAddEvent) { this.cardAddedEvent = event; }
    onCardUpdated(event: KanbanCard) { this.cardUpdatedEvent = event; }
    onCardDeleted(id: string) { this.cardDeletedId = id; }
    onColumnAdded(event: unknown) { this.columnAddedEvent = event; }
    onColumnUpdated(event: KanbanColumn) { this.columnUpdatedEvent = event; }
    onColumnDeleted(event: KanbanColumnDeleteEvent) { this.columnDeletedEvent = event; }
    onHistoryChange(state: KanbanHistoryState) { this.historyState = state; }
}

// Custom mode test host
@Component({
    template: `
        <ui-kanban>
            <ui-kanban-column columnId="custom-col" title="Custom Column">
                <ui-kanban-column-header>
                    <h3 class="custom-header">Custom Header</h3>
                </ui-kanban-column-header>
                <ui-kanban-card cardId="custom-card">
                    <ui-kanban-card-content>
                        <p class="custom-content">Custom Card</p>
                    </ui-kanban-card-content>
                </ui-kanban-card>
            </ui-kanban-column>
        </ui-kanban>
    `,
    imports: [
        KanbanComponent,
        KanbanColumnComponent,
        KanbanCardComponent,
        KanbanColumnHeaderComponent,
        KanbanCardContentComponent,
    ],
})
class KanbanCustomTestHostComponent {}

describe('KanbanComponent', () => {
    describe('Simple Mode', () => {
        let fixture: ComponentFixture<KanbanSimpleTestHostComponent>;
        let component: KanbanSimpleTestHostComponent;

        beforeEach(async () => {
            await TestBed.configureTestingModule({
                imports: [KanbanSimpleTestHostComponent],
            }).compileComponents();

            fixture = TestBed.createComponent(KanbanSimpleTestHostComponent);
            component = fixture.componentInstance;
            fixture.detectChanges();
        });

        it('should render kanban board with data-slot', () => {
            const kanban = fixture.debugElement.query(By.css('[data-slot="kanban"]'));
            expect(kanban).toBeTruthy();
        });

        it('should render all columns', () => {
            const columns = fixture.debugElement.queryAll(By.css('[data-slot="kanban-column"]'));
            expect(columns.length).toBe(3);
        });

        it('should render column titles', () => {
            const headers = fixture.debugElement.queryAll(By.css('[data-slot="kanban-column-header"]'));
            expect(headers.length).toBe(3);

            const titles = fixture.nativeElement.querySelectorAll('.text-sm.font-semibold');
            expect(titles[0].textContent).toContain('To Do');
            expect(titles[1].textContent).toContain('In Progress');
            expect(titles[2].textContent).toContain('Done');
        });

        it('should render cards in correct columns', () => {
            const columns = fixture.debugElement.queryAll(By.css('[data-slot="kanban-column"]'));
            const todoCards = columns[0].queryAll(By.css('[data-slot="kanban-card"]'));
            const doingCards = columns[1].queryAll(By.css('[data-slot="kanban-card"]'));
            const doneCards = columns[2].queryAll(By.css('[data-slot="kanban-card"]'));

            expect(todoCards.length).toBe(2);
            expect(doingCards.length).toBe(1);
            expect(doneCards.length).toBe(0);
        });

        it('should display card titles', () => {
            const cards = fixture.debugElement.queryAll(By.css('[data-slot="kanban-card"]'));
            expect(cards[0].nativeElement.textContent).toContain('Task 1');
        });

        it('should display card descriptions', () => {
            const cards = fixture.debugElement.queryAll(By.css('[data-slot="kanban-card"]'));
            expect(cards[0].nativeElement.textContent).toContain('First task');
        });

        it('should render priority border on cards', () => {
            const cards = fixture.debugElement.queryAll(By.css('[data-slot="kanban-card"]'));
            expect(cards[0].nativeElement.className).toContain('border-s-orange-500');
        });

        it('should render card labels as badges', () => {
            const badges = fixture.debugElement.queryAll(By.css('[data-slot="kanban-card"] [data-slot="badge"]'));
            expect(badges.length).toBeGreaterThan(0);
        });

        it('should render card count badges on columns', () => {
            const badges = fixture.debugElement.queryAll(By.css('[data-slot="kanban-column-header"] [data-slot="badge"]'));
            expect(badges.length).toBe(3);
        });

        it('should filter cards by search term', async () => {
            component.searchTerm.set('Task 1');
            fixture.detectChanges();
            await fixture.whenStable();

            const cards = fixture.debugElement.queryAll(By.css('[data-slot="kanban-card"]'));
            expect(cards.length).toBe(1);
            expect(cards[0].nativeElement.textContent).toContain('Task 1');
        });

        it('should make cards draggable', () => {
            const card = fixture.debugElement.query(By.css('[data-slot="kanban-card"]'));
            expect(card.nativeElement.getAttribute('draggable')).toBe('true');
        });

        it('should always render drop indicators in DOM', () => {
            const indicators = fixture.debugElement.queryAll(
                By.css('[data-slot="kanban-drop-indicator"]')
            );
            expect(indicators.length).toBe(3);
            indicators.forEach(ind => {
                expect(ind.nativeElement.classList).toContain('opacity-0');
            });
        });

        it('should set data-drag-over attribute on column during drag', () => {
            const kanbanEl = fixture.debugElement.query(By.directive(KanbanComponent));
            const kanban = kanbanEl.componentInstance as KanbanComponent;
            kanban.startDrag('card-1', 'todo');
            fixture.detectChanges();

            const columns = fixture.debugElement.queryAll(By.css('[data-slot="kanban-column"]'));
            const doingColumn = columns[1];

            doingColumn.nativeElement.dispatchEvent(
                new Event('dragenter', { bubbles: true })
            );
            fixture.detectChanges();

            expect(doingColumn.nativeElement.dataset.dragOver).toBe('true');
        });

        it('should remove drag-over state after drag leave', () => {
            const kanbanEl = fixture.debugElement.query(By.directive(KanbanComponent));
            const kanban = kanbanEl.componentInstance as KanbanComponent;
            kanban.startDrag('card-1', 'todo');
            fixture.detectChanges();

            const columns = fixture.debugElement.queryAll(By.css('[data-slot="kanban-column"]'));
            const doingColumn = columns[1];

            doingColumn.nativeElement.dispatchEvent(
                new Event('dragenter', { bubbles: true })
            );
            fixture.detectChanges();

            doingColumn.nativeElement.dispatchEvent(
                new Event('dragleave', { bubbles: true })
            );
            fixture.detectChanges();

            expect(doingColumn.nativeElement.dataset.dragOver).toBeUndefined();
        });

        it('should apply visual feedback classes to dragged card', () => {
            const kanbanEl = fixture.debugElement.query(By.directive(KanbanComponent));
            const kanban = kanbanEl.componentInstance as KanbanComponent;
            kanban.startDrag('card-1', 'todo');
            fixture.detectChanges();

            const card = fixture.debugElement.query(
                By.css('[data-card-id="card-1"]')
            );
            expect(card.nativeElement.className).toContain('opacity-50');
            expect(card.nativeElement.className).toContain('scale-[0.98]');
        });

        it('should clean up all drag state on drop', () => {
            const kanbanEl = fixture.debugElement.query(By.directive(KanbanComponent));
            const kanban = kanbanEl.componentInstance as KanbanComponent;
            kanban.startDrag('card-1', 'todo');
            fixture.detectChanges();

            const columns = fixture.debugElement.queryAll(By.css('[data-slot="kanban-column"]'));
            const doingColumn = columns[1];

            doingColumn.nativeElement.dispatchEvent(
                new Event('dragenter', { bubbles: true })
            );
            fixture.detectChanges();

            const dropEvent = new Event('drop', { bubbles: true });
            Object.defineProperty(dropEvent, 'dataTransfer', {
                value: { getData: () => 'card-1' }
            });
            doingColumn.nativeElement.dispatchEvent(dropEvent);
            fixture.detectChanges();

            expect(doingColumn.nativeElement.dataset.dragOver).toBeUndefined();
        });

        it('should render add-card button in each column header', () => {
            const buttons = fixture.debugElement.queryAll(
                By.css('[data-slot="kanban-add-card-button"]')
            );
            expect(buttons.length).toBe(3);
        });

        it('should render empty state in column with no cards', () => {
            const columns = fixture.debugElement.queryAll(By.css('[data-slot="kanban-column"]'));
            const doneColumn = columns[2];
            const emptyState = doneColumn.query(By.css('[data-slot="kanban-empty-state"]'));
            expect(emptyState).toBeTruthy();
            expect(emptyState.nativeElement.textContent).toContain('No cards yet');
        });

        it('should duplicate card via context menu action', () => {
            const kanbanEl = fixture.debugElement.query(By.directive(KanbanComponent));
            const kanban = kanbanEl.componentInstance as KanbanComponent;
            const card = component.cards()[0];

            kanban.onDuplicateCard(card);
            fixture.detectChanges();

            expect(component.cardAddedEvent).toBeTruthy();
            expect(component.cardAddedEvent!.title).toContain('(copy)');
            expect(component.cardAddedEvent!.columnId).toBe('todo');
        });

        it('should move card to another column via context menu', () => {
            const kanbanEl = fixture.debugElement.query(By.directive(KanbanComponent));
            const kanban = kanbanEl.componentInstance as KanbanComponent;
            const card = component.cards()[0];

            kanban.onMoveCardToColumn(card, 'doing');
            fixture.detectChanges();

            expect(component.cardsChanged.length).toBe(3);
            const movedCard = component.cardsChanged.find(c => c.id === 'card-1');
            expect(movedCard?.columnId).toBe('doing');
        });

        it('should set card priority via context menu', () => {
            const kanbanEl = fixture.debugElement.query(By.directive(KanbanComponent));
            const kanban = kanbanEl.componentInstance as KanbanComponent;
            const card = component.cards()[0];

            kanban.onSetCardPriority(card, 'low');
            fixture.detectChanges();

            expect(component.cardUpdatedEvent).toBeTruthy();
            expect(component.cardUpdatedEvent!.priority).toBe('low');
        });

        it('should clear priority when set to none', () => {
            const kanbanEl = fixture.debugElement.query(By.directive(KanbanComponent));
            const kanban = kanbanEl.componentInstance as KanbanComponent;
            const card = component.cards()[0];

            kanban.onSetCardPriority(card, 'none');
            fixture.detectChanges();

            expect(component.cardUpdatedEvent).toBeTruthy();
            expect(component.cardUpdatedEvent!.priority).toBeUndefined();
        });

        it('should delete card with delayed emit', () => {
            vi.useFakeTimers();
            const kanbanEl = fixture.debugElement.query(By.directive(KanbanComponent));
            const kanban = kanbanEl.componentInstance as KanbanComponent;
            const card = component.cards()[0];

            kanban.onDeleteCard(card);
            fixture.detectChanges();

            expect(component.cardsChanged.length).toBe(2);
            expect(component.cardDeletedId).toBeNull();

            vi.advanceTimersByTime(6000);

            expect(component.cardDeletedId).toBe('card-1');
            vi.useRealTimers();
        });

        it('should emit historyChange after undo', () => {
            const kanbanEl = fixture.debugElement.query(By.directive(KanbanComponent));
            const kanban = kanbanEl.componentInstance as KanbanComponent;
            const card = component.cards()[0];

            kanban.onMoveCardToColumn(card, 'doing');
            fixture.detectChanges();

            expect(component.historyState).toBeTruthy();
            expect(component.historyState!.canUndo).toBe(true);
            expect(component.historyState!.canRedo).toBe(false);
        });

        it('should undo last action', () => {
            const kanbanEl = fixture.debugElement.query(By.directive(KanbanComponent));
            const kanban = kanbanEl.componentInstance as KanbanComponent;
            const originalCards = [...component.cards()];
            const card = component.cards()[0];

            kanban.onMoveCardToColumn(card, 'doing');
            fixture.detectChanges();

            kanban.undo();
            fixture.detectChanges();

            expect(component.cardsChanged).toEqual(originalCards);
            expect(component.historyState!.canUndo).toBe(false);
            expect(component.historyState!.canRedo).toBe(true);
        });

        it('should redo undone action', () => {
            const kanbanEl = fixture.debugElement.query(By.directive(KanbanComponent));
            const kanban = kanbanEl.componentInstance as KanbanComponent;
            const card = component.cards()[0];

            kanban.onMoveCardToColumn(card, 'doing');
            fixture.detectChanges();
            const afterMoveCards = [...component.cardsChanged];

            kanban.undo();
            fixture.detectChanges();

            kanban.redo();
            fixture.detectChanges();

            expect(component.cardsChanged).toEqual(afterMoveCards);
            expect(component.historyState!.canUndo).toBe(true);
            expect(component.historyState!.canRedo).toBe(false);
        });

        it('should reorder columns left', () => {
            const kanbanEl = fixture.debugElement.query(By.directive(KanbanComponent));
            const kanban = kanbanEl.componentInstance as KanbanComponent;
            const doingCol = component.columns()[1];

            kanban.onMoveColumnLeft(doingCol);
            fixture.detectChanges();

            const movedCol = component.columnsChanged.find(c => c.id === 'doing');
            const todoCol = component.columnsChanged.find(c => c.id === 'todo');
            expect(movedCol!.order).toBeLessThan(todoCol!.order);
        });

        it('should reorder columns right', () => {
            const kanbanEl = fixture.debugElement.query(By.directive(KanbanComponent));
            const kanban = kanbanEl.componentInstance as KanbanComponent;
            const doingCol = component.columns()[1];

            kanban.onMoveColumnRight(doingCol);
            fixture.detectChanges();

            const movedCol = component.columnsChanged.find(c => c.id === 'doing');
            const doneCol = component.columnsChanged.find(c => c.id === 'done');
            expect(movedCol!.order).toBeGreaterThan(doneCol!.order);
        });

        it('should not move first column left', () => {
            const kanbanEl = fixture.debugElement.query(By.directive(KanbanComponent));
            const kanban = kanbanEl.componentInstance as KanbanComponent;
            const todoCol = component.columns()[0];

            kanban.onMoveColumnLeft(todoCol);
            fixture.detectChanges();

            expect(component.columnsChanged.length).toBe(0);
        });

        it('should capture snapshot on moveCard for history', () => {
            const kanbanEl = fixture.debugElement.query(By.directive(KanbanComponent));
            const kanban = kanbanEl.componentInstance as KanbanComponent;

            kanban.moveCard('card-1', 'doing', 0);
            fixture.detectChanges();

            expect(component.historyState).toBeTruthy();
            expect(component.historyState!.canUndo).toBe(true);
        });
    });

    describe('Custom Mode', () => {
        let fixture: ComponentFixture<KanbanCustomTestHostComponent>;

        beforeEach(async () => {
            await TestBed.configureTestingModule({
                imports: [KanbanCustomTestHostComponent],
            }).compileComponents();

            fixture = TestBed.createComponent(KanbanCustomTestHostComponent);
            fixture.detectChanges();
        });

        it('should render custom column header', () => {
            const header = fixture.nativeElement.querySelector('.custom-header');
            expect(header).toBeTruthy();
            expect(header.textContent).toContain('Custom Header');
        });

        it('should render custom card content', () => {
            const content = fixture.nativeElement.querySelector('.custom-content');
            expect(content).toBeTruthy();
            expect(content.textContent).toContain('Custom Card');
        });

        it('should render kanban data-slot in custom mode', () => {
            const kanban = fixture.debugElement.query(By.css('[data-slot="kanban"]'));
            expect(kanban).toBeTruthy();
        });
    });
});

describe('KanbanComponent — i18n integration', () => {
    async function setup(opts: { locale?: string; providerLocale?: string } = {}) {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [KanbanComponent],
            providers: opts.providerLocale ? [provideUiLocale(opts.providerLocale)] : [],
        }).compileComponents();
        const fixture = TestBed.createComponent(KanbanComponent);
        if (opts.locale) fixture.componentRef.setInput('locale', opts.locale);
        fixture.detectChanges();
        return fixture;
    }

    it('defaults resolvedLocale to English KanbanLocale', async () => {
        const fixture = await setup();
        const t = fixture.componentInstance.resolvedLocale();
        expect(t.code).toBe('en');
        expect(t.addCard).toBe('Add Card');
        expect(t.addColumn).toBe('Add Column');
    });

    it('localises resolvedLocale when locale="he" and sets rtl=true', async () => {
        const fixture = await setup({ locale: 'he' });
        const cmp = fixture.componentInstance;
        expect(cmp.resolvedLocale().code).toBe('he');
        expect(cmp.resolvedLocale().rtl).toBe(true);
        expect(cmp.dir()).toBe('rtl');
    });

    it('falls back to UI_LOCALE_ID when no locale input is set', async () => {
        const fixture = await setup({ providerLocale: 'fr' });
        expect(fixture.componentInstance.resolvedLocale().code).toBe('fr');
    });
});
