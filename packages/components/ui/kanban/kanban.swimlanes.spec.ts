import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    KanbanComponent,
    type KanbanCard,
    type KanbanCardMoveEvent,
    type KanbanColumn,
    type KanbanSwimlaneBy,
} from './kanban.component';

/**
 * Feature specs for kanban swimlanes (T-12, T-13). `kanban.component.spec.ts`
 * is the untouched backward-compatibility gate.
 */

interface AssignedCard extends KanbanCard { assignee?: string }

const COLUMNS: KanbanColumn[] = [
    { id: 'todo', title: 'To Do', order: 0 },
    { id: 'doing', title: 'Doing', order: 1 },
];

function card(id: string, columnId: string, assignee: string | undefined, order: number): AssignedCard {
    return { id, columnId, title: id, order, assignee };
}

const CARDS: AssignedCard[] = [
    card('a1', 'todo', 'ada', 0),
    card('a2', 'doing', 'ada', 0),
    card('g1', 'todo', 'grace', 1),
    card('u1', 'todo', undefined, 2),
];

@Component({
    imports: [KanbanComponent],
    template: `
        <ui-kanban
            [columns]="columns()"
            [cards]="cards()"
            [swimlaneBy]="swimlaneBy()"
            [swimlaneLabel]="swimlaneLabel()"
            [initiallyCollapsedSwimlanes]="initiallyCollapsed()"
            [searchTerm]="searchTerm()"
            (cardsChange)="lastCards = $event"
            (cardMoved)="moves.push($event)"
        />
    `,
})
class SwimlaneHostComponent {
    readonly columns = signal<KanbanColumn[]>(COLUMNS);
    readonly cards = signal<AssignedCard[]>(CARDS);
    readonly swimlaneBy = signal<KanbanSwimlaneBy>('assignee');
    readonly swimlaneLabel = signal<((id: string) => string) | null>(null);
    readonly initiallyCollapsed = signal<readonly string[]>([]);
    readonly searchTerm = signal('');
    readonly moves: KanbanCardMoveEvent[] = [];
    lastCards: KanbanCard[] = [];
}

describe('KanbanComponent — swimlanes', () => {
    let fixture: ComponentFixture<SwimlaneHostComponent>;
    let host: SwimlaneHostComponent;
    let board: KanbanComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [SwimlaneHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(SwimlaneHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
        board = fixture.debugElement.query(By.directive(KanbanComponent)).componentInstance;
    });

    afterEach(() => TestBed.resetTestingModule());

    function laneEls(): HTMLElement[] {
        return Array.from(fixture.nativeElement.querySelectorAll('[data-slot="kanban-swimlane"]'));
    }

    it('is off by default, leaving the board exactly as it was', () => {
        host.swimlaneBy.set(null);
        fixture.detectChanges();

        expect(board.hasSwimlanes()).toBe(false);
        expect(board.swimlanes()).toEqual([]);
        expect(laneEls()).toHaveLength(0);
        expect(fixture.nativeElement.querySelector('[data-slot="kanban"]')).not.toBeNull();
    });

    it('groups cards into one lane per distinct value', () => {
        expect(board.swimlanes().map(l => l.id)).toEqual(['ada', 'grace', '']);
        expect(laneEls()).toHaveLength(3);
    });

    it('counts the cards in each lane', () => {
        expect(board.swimlanes()).toEqual([
            { id: 'ada', label: 'ada', count: 2 },
            { id: 'grace', label: 'grace', count: 1 },
            { id: '', label: 'Unassigned', count: 1 },
        ]);
    });

    it('collects value-less cards in a single unnamed lane, rendered last', () => {
        const last = board.swimlanes().at(-1);
        expect(last?.id).toBe('');
        expect(last?.label).toBe('Unassigned');
    });

    it('scopes each column to its own lane', () => {
        expect(board.getCardsForColumn('todo', 'ada').map(c => c.id)).toEqual(['a1']);
        expect(board.getCardsForColumn('todo', 'grace').map(c => c.id)).toEqual(['g1']);
        expect(board.getCardsForColumn('todo', '').map(c => c.id)).toEqual(['u1']);
        expect(board.getCardsForColumn('doing', 'grace')).toEqual([]);
    });

    it('keeps the un-scoped call returning the whole column, as before', () => {
        expect(board.getCardsForColumn('todo').map(c => c.id)).toEqual(['a1', 'g1', 'u1']);
    });

    it('renders one column instance per lane', () => {
        const columns = fixture.nativeElement.querySelectorAll('[data-slot="kanban-column"]');
        expect(columns).toHaveLength(3 * COLUMNS.length);
    });

    it('accepts a derived lane function as well as a property name', () => {
        host.swimlaneBy.set((c: KanbanCard) => (c.columnId === 'todo' ? 'left' : 'right'));
        fixture.detectChanges();

        expect(board.swimlanes().map(l => l.id)).toEqual(['left', 'right']);
    });

    it('honours a custom label function', () => {
        host.swimlaneLabel.set(id => (id === '' ? 'Nobody' : id.toUpperCase()));
        fixture.detectChanges();

        expect(board.swimlanes().map(l => l.label)).toEqual(['ADA', 'GRACE', 'Nobody']);
    });

    it('drops a lane whose every card is filtered out by the search', () => {
        host.searchTerm.set('g1');
        fixture.detectChanges();

        expect(board.swimlanes().map(l => l.id)).toEqual(['grace']);
    });

    it('renders no lane at all for an empty board', () => {
        host.cards.set([]);
        fixture.detectChanges();

        expect(board.swimlanes()).toEqual([]);
        expect(laneEls()).toHaveLength(0);
    });
});

describe('KanbanComponent — swimlane collapse', () => {
    let fixture: ComponentFixture<SwimlaneHostComponent>;
    let host: SwimlaneHostComponent;
    let board: KanbanComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [SwimlaneHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(SwimlaneHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
        board = fixture.debugElement.query(By.directive(KanbanComponent)).componentInstance;
    });

    afterEach(() => TestBed.resetTestingModule());

    function headers(): HTMLElement[] {
        return Array.from(fixture.nativeElement.querySelectorAll('[data-slot="kanban-swimlane-header"]'));
    }

    it('starts every lane expanded', () => {
        expect(board.collapsedSwimlanes().size).toBe(0);
        expect(headers().every(h => h.getAttribute('aria-expanded') === 'true')).toBe(true);
    });

    it('collapses each lane independently', () => {
        board.toggleSwimlane('ada');
        fixture.detectChanges();

        expect(board.isSwimlaneCollapsed('ada')).toBe(true);
        expect(board.isSwimlaneCollapsed('grace')).toBe(false);
        expect(headers()[0].getAttribute('aria-expanded')).toBe('false');
        expect(headers()[1].getAttribute('aria-expanded')).toBe('true');
    });

    it('removes only the collapsed lane columns from the DOM', () => {
        const before = fixture.nativeElement.querySelectorAll('[data-slot="kanban-column"]').length;
        board.toggleSwimlane('ada');
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelectorAll('[data-slot="kanban-column"]')).toHaveLength(before - COLUMNS.length);
    });

    it('toggles back open', () => {
        board.toggleSwimlane('ada');
        board.toggleSwimlane('ada');
        fixture.detectChanges();

        expect(board.isSwimlaneCollapsed('ada')).toBe(false);
    });

    it('collapses from a header click', () => {
        headers()[1].click();
        fixture.detectChanges();

        expect(board.isSwimlaneCollapsed('grace')).toBe(true);
    });

    it('seeds the initial collapse set once, without fighting the user afterwards', () => {
        host.initiallyCollapsed.set(['ada']);
        fixture.detectChanges();
        expect(board.isSwimlaneCollapsed('ada')).toBe(true);

        board.toggleSwimlane('ada');
        host.cards.set([...CARDS, card('a3', 'doing', 'ada', 1)]);
        fixture.detectChanges();

        expect(board.isSwimlaneCollapsed('ada')).toBe(false);
    });
});

describe('KanbanComponent — dragging within and across swimlanes', () => {
    let fixture: ComponentFixture<SwimlaneHostComponent>;
    let host: SwimlaneHostComponent;
    let board: KanbanComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [SwimlaneHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(SwimlaneHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
        board = fixture.debugElement.query(By.directive(KanbanComponent)).componentInstance;
        host.moves.length = 0;
    });

    afterEach(() => TestBed.resetTestingModule());

    it('moves a card between columns within one lane, leaving the lane alone', () => {
        board.moveCard('a1', 'doing', 0, 'ada');
        fixture.detectChanges();

        const moved = host.lastCards.find(c => c.id === 'a1') as AssignedCard;
        expect(moved.columnId).toBe('doing');
        expect(moved.assignee).toBe('ada');
        expect(host.moves.at(-1)).toMatchObject({
            cardId: 'a1', fromColumnId: 'todo', toColumnId: 'doing',
            fromSwimlaneId: 'ada', toSwimlaneId: 'ada',
        });
    });

    it('reassigns the grouping field when a card crosses lanes', () => {
        board.moveCard('a1', 'todo', 0, 'grace');
        fixture.detectChanges();

        expect((host.lastCards.find(c => c.id === 'a1') as AssignedCard).assignee).toBe('grace');
        expect(host.moves.at(-1)).toMatchObject({ fromSwimlaneId: 'ada', toSwimlaneId: 'grace' });
    });

    it('can drop a card into the unnamed lane', () => {
        board.moveCard('a1', 'todo', 0, '');
        fixture.detectChanges();

        expect((host.lastCards.find(c => c.id === 'a1') as AssignedCard).assignee).toBe('');
        expect(host.moves.at(-1)?.toSwimlaneId).toBe('');
    });

    it('does not invent a lane field when the lane is derived by a function', () => {
        host.swimlaneBy.set((c: KanbanCard) => (c.columnId === 'todo' ? 'left' : 'right'));
        fixture.detectChanges();

        board.moveCard('a1', 'doing', 0, 'right');
        fixture.detectChanges();

        const moved = host.lastCards.find(c => c.id === 'a1') as AssignedCard;
        expect(moved.columnId).toBe('doing');
        expect(moved.assignee).toBe('ada');
        expect(host.moves.at(-1)?.toSwimlaneId).toBe('right');
    });

    it('omits the swimlane fields entirely when swimlanes are off', () => {
        host.swimlaneBy.set(null);
        fixture.detectChanges();

        board.moveCard('a1', 'doing', 0);
        fixture.detectChanges();

        const move = host.moves.at(-1);
        expect(move).toMatchObject({ cardId: 'a1', toColumnId: 'doing', newOrder: 0 });
        expect(move && 'toSwimlaneId' in move).toBe(false);
    });

    it('still records an undo snapshot for a cross-lane move', () => {
        board.moveCard('a1', 'todo', 0, 'grace');
        fixture.detectChanges();
        host.cards.set(host.lastCards as AssignedCard[]);
        fixture.detectChanges();

        board.undo();
        fixture.detectChanges();

        expect((host.lastCards.find(c => c.id === 'a1') as AssignedCard).assignee).toBe('ada');
    });
});
