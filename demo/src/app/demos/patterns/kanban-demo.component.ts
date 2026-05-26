import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import {
  BadgeComponent,
  SeparatorComponent,
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
} from '../../../../../packages/components/ui';
import { KANBAN_DEMO_LOCALES } from './kanban-demo.locales';

@Component({
  selector: 'app-kanban-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    SeparatorComponent,
    KanbanComponent,
    KanbanColumnComponent,
    KanbanCardComponent,
    KanbanColumnHeaderComponent,
    KanbanCardContentComponent,
  ],
  templateUrl: './kanban-demo.component.html',
})
export class KanbanDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => KANBAN_DEMO_LOCALES[this.localeId()] ?? KANBAN_DEMO_LOCALES['en'],
  );

  readonly kanbanColumns = signal<KanbanColumn[]>([...this.t().columns]);
  readonly kanbanCards = signal<KanbanCard[]>([...this.t().cards]);
  readonly kanbanHistory = signal<KanbanHistoryState>({ canUndo: false, canRedo: false });
  private kanbanCardIdCounter = 100;

  constructor() {
    let prev = this.t();
    effect(() => {
      const next = this.t();
      if (next !== prev) {
        this.kanbanColumns.set([...next.columns]);
        this.kanbanCards.set([...next.cards]);
        prev = next;
      }
    }, { allowSignalWrites: true });
  }

  onKanbanCardsChange(cards: KanbanCard[]) { this.kanbanCards.set(cards); }
  onKanbanColumnsChange(columns: KanbanColumn[]) { this.kanbanColumns.set(columns); }

  onKanbanCardAdded(event: KanbanCardAddEvent) {
    const newCard: KanbanCard = {
      id: `k-${++this.kanbanCardIdCounter}`,
      columnId: event.columnId,
      title: event.title,
      description: event.description,
      priority: event.priority,
      labels: event.labels,
      assignees: event.assignees,
      order: this.kanbanCards().filter(c => c.columnId === event.columnId).length,
    };
    this.kanbanCards.set([...this.kanbanCards(), newCard]);
  }

  onKanbanCardUpdated(card: KanbanCard) {
    this.kanbanCards.set(this.kanbanCards().map(c => c.id === card.id ? card : c));
  }

  onKanbanCardDeleted(cardId: string) {
    this.kanbanCards.set(this.kanbanCards().filter(c => c.id !== cardId));
  }

  onKanbanColumnAdded(col: Omit<KanbanColumn, 'id'>) {
    const newCol: KanbanColumn = { ...col, id: `col-${Date.now()}` };
    this.kanbanColumns.set([...this.kanbanColumns(), newCol]);
  }

  onKanbanColumnUpdated(col: KanbanColumn) {
    this.kanbanColumns.set(this.kanbanColumns().map(c => c.id === col.id ? col : c));
  }

  onKanbanColumnDeleted(event: KanbanColumnDeleteEvent) {
    if (event.moveCardsTo) {
      this.kanbanCards.set(
        this.kanbanCards().map(c =>
          c.columnId === event.columnId ? { ...c, columnId: event.moveCardsTo! } : c
        )
      );
    } else {
      this.kanbanCards.set(this.kanbanCards().filter(c => c.columnId !== event.columnId));
    }
    this.kanbanColumns.set(this.kanbanColumns().filter(c => c.id !== event.columnId));
  }

  onKanbanHistoryChange(state: KanbanHistoryState) { this.kanbanHistory.set(state); }
}
