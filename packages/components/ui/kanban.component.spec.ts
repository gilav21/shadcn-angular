import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import {
    KanbanComponent,
    KanbanColumnComponent,
    KanbanCardComponent,
    KanbanColumnHeaderComponent,
    KanbanCardContentComponent,
    KanbanColumn,
    KanbanCard,
} from './kanban.component';

// Simple mode test host
@Component({
    template: `
        <ui-kanban
            [columns]="columns()"
            [cards]="cards()"
            [searchTerm]="searchTerm()"
            (cardsChange)="onCardsChange($event)"
            (cardMoved)="onCardMoved($event)"
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
    cardMovedEvent: unknown = null;

    onCardsChange(cards: KanbanCard[]) { this.cardsChanged = cards; }
    onCardMoved(event: unknown) { this.cardMovedEvent = event; }
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
            expect(cards[0].nativeElement.className).toContain('border-l-orange-500');
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

            expect(doingColumn.nativeElement.getAttribute('data-drag-over')).toBe('true');
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

            expect(doingColumn.nativeElement.getAttribute('data-drag-over')).toBeNull();
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

            expect(doingColumn.nativeElement.getAttribute('data-drag-over')).toBeNull();
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
