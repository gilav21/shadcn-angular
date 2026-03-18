import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
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
  readonly kanbanColumns = signal<KanbanColumn[]>([
    { id: 'backlog', title: 'Backlog', order: 0 },
    { id: 'todo', title: 'To Do', order: 1, wipLimit: 4 },
    { id: 'in-progress', title: 'In Progress', order: 2, wipLimit: 3 },
    { id: 'review', title: 'Review', order: 3, wipLimit: 2 },
    { id: 'done', title: 'Done', order: 4 },
  ]);

  readonly kanbanCards = signal<KanbanCard[]>([
    { id: 'k1', columnId: 'backlog', title: 'Research competitors', description: 'Analyze top 5 competitor products', priority: 'low', order: 0, labels: [{ text: 'Research', color: '#6366f1' }] },
    { id: 'k2', columnId: 'backlog', title: 'Design system audit', priority: 'medium', order: 1, labels: [{ text: 'Design', color: '#ec4899' }] },
    { id: 'k3', columnId: 'todo', title: 'Implement auth flow', description: 'OAuth2 + JWT token refresh', priority: 'high', order: 0, labels: [{ text: 'Backend', color: '#f59e0b' }], assignees: [{ name: 'Alice' }, { name: 'Bob' }] },
    { id: 'k4', columnId: 'todo', title: 'Setup CI/CD pipeline', priority: 'medium', order: 1, labels: [{ text: 'DevOps', color: '#10b981' }], assignees: [{ name: 'Charlie' }] },
    { id: 'k5', columnId: 'in-progress', title: 'Build dashboard UI', description: 'Charts, tables, and KPI cards', priority: 'high', order: 0, labels: [{ text: 'Frontend', color: '#3b82f6' }], assignees: [{ name: 'Diana' }] },
    { id: 'k6', columnId: 'in-progress', title: 'API rate limiting', priority: 'urgent', order: 1, labels: [{ text: 'Backend', color: '#f59e0b' }, { text: 'Security', color: '#ef4444' }], assignees: [{ name: 'Eve' }] },
    { id: 'k7', columnId: 'review', title: 'User profile page', description: 'Avatar upload, settings, preferences', priority: 'medium', order: 0, assignees: [{ name: 'Frank' }, { name: 'Grace' }] },
    { id: 'k8', columnId: 'done', title: 'Project setup', priority: 'low', order: 0, labels: [{ text: 'DevOps', color: '#10b981' }] },
    { id: 'k9', columnId: 'done', title: 'Database schema', priority: 'high', order: 1, labels: [{ text: 'Backend', color: '#f59e0b' }] },
  ]);

  readonly kanbanHistory = signal<KanbanHistoryState>({ canUndo: false, canRedo: false });
  private kanbanCardIdCounter = 100;

  onKanbanCardsChange(cards: KanbanCard[]) {
    this.kanbanCards.set(cards);
  }

  onKanbanColumnsChange(columns: KanbanColumn[]) {
    this.kanbanColumns.set(columns);
  }

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
    const newCol: KanbanColumn = {
      ...col,
      id: `col-${Date.now()}`,
    };
    this.kanbanColumns.set([...this.kanbanColumns(), newCol]);
  }

  onKanbanColumnUpdated(col: KanbanColumn) {
    this.kanbanColumns.set(this.kanbanColumns().map(c => c.id === col.id ? col : c));
  }

  onKanbanColumnDeleted(event: KanbanColumnDeleteEvent) {
    if (event.moveCardsTo) {
      const movedCards = this.kanbanCards().map(c =>
        c.columnId === event.columnId ? { ...c, columnId: event.moveCardsTo! } : c
      );
      this.kanbanCards.set(movedCards);
    } else {
      this.kanbanCards.set(this.kanbanCards().filter(c => c.columnId !== event.columnId));
    }
    this.kanbanColumns.set(this.kanbanColumns().filter(c => c.id !== event.columnId));
  }

  onKanbanHistoryChange(state: KanbanHistoryState) {
    this.kanbanHistory.set(state);
  }

  readonly hebrewKanbanColumns = signal<KanbanColumn[]>([
    { id: 'backlog', title: 'צבר משימות', order: 0 },
    { id: 'todo', title: 'לביצוע', order: 1, wipLimit: 4 },
    { id: 'in-progress', title: 'בתהליך', order: 2, wipLimit: 3 },
    { id: 'review', title: 'בבדיקה', order: 3, wipLimit: 2 },
    { id: 'done', title: 'הושלם', order: 4 },
  ]);

  readonly hebrewKanbanCards = signal<KanbanCard[]>([
    { id: 'hk1', columnId: 'backlog', title: 'מחקר מתחרים', description: 'ניתוח 5 מוצרי מתחרים מובילים', priority: 'low', order: 0, labels: [{ text: 'מחקר', color: '#6366f1' }] },
    { id: 'hk2', columnId: 'backlog', title: 'בדיקת מערכת עיצוב', priority: 'medium', order: 1, labels: [{ text: 'עיצוב', color: '#ec4899' }] },
    { id: 'hk3', columnId: 'todo', title: 'מימוש זרימת אימות', description: 'OAuth2 + רענון טוקן JWT', priority: 'high', order: 0, labels: [{ text: 'צד שרת', color: '#f59e0b' }], assignees: [{ name: 'יעל' }, { name: 'דוד' }] },
    { id: 'hk4', columnId: 'todo', title: 'הקמת צינור CI/CD', priority: 'medium', order: 1, labels: [{ text: 'תשתיות', color: '#10b981' }], assignees: [{ name: 'משה' }] },
    { id: 'hk5', columnId: 'in-progress', title: 'בניית ממשק לוח בקרה', description: 'גרפים, טבלאות וכרטיסי KPI', priority: 'high', order: 0, labels: [{ text: 'צד לקוח', color: '#3b82f6' }], assignees: [{ name: 'שרה' }] },
    { id: 'hk6', columnId: 'in-progress', title: 'הגבלת קצב API', priority: 'urgent', order: 1, labels: [{ text: 'צד שרת', color: '#f59e0b' }, { text: 'אבטחה', color: '#ef4444' }], assignees: [{ name: 'רחל' }] },
    { id: 'hk7', columnId: 'review', title: 'דף פרופיל משתמש', description: 'העלאת תמונה, הגדרות, העדפות', priority: 'medium', order: 0, assignees: [{ name: 'אבי' }, { name: 'נועה' }] },
    { id: 'hk8', columnId: 'done', title: 'הקמת פרויקט', priority: 'low', order: 0, labels: [{ text: 'תשתיות', color: '#10b981' }] },
    { id: 'hk9', columnId: 'done', title: 'סכמת בסיס נתונים', priority: 'high', order: 1, labels: [{ text: 'צד שרת', color: '#f59e0b' }] },
  ]);

  readonly hebrewKanbanHistory = signal<KanbanHistoryState>({ canUndo: false, canRedo: false });
  private hebrewKanbanCardIdCounter = 200;

  onHebrewKanbanCardsChange(cards: KanbanCard[]) {
    this.hebrewKanbanCards.set(cards);
  }

  onHebrewKanbanColumnsChange(columns: KanbanColumn[]) {
    this.hebrewKanbanColumns.set(columns);
  }

  onHebrewKanbanCardAdded(event: KanbanCardAddEvent) {
    const newCard: KanbanCard = {
      id: `hk-${++this.hebrewKanbanCardIdCounter}`,
      columnId: event.columnId,
      title: event.title,
      description: event.description,
      priority: event.priority,
      labels: event.labels,
      assignees: event.assignees,
      order: this.hebrewKanbanCards().filter(c => c.columnId === event.columnId).length,
    };
    this.hebrewKanbanCards.set([...this.hebrewKanbanCards(), newCard]);
  }

  onHebrewKanbanCardUpdated(card: KanbanCard) {
    this.hebrewKanbanCards.set(this.hebrewKanbanCards().map(c => c.id === card.id ? card : c));
  }

  onHebrewKanbanCardDeleted(cardId: string) {
    this.hebrewKanbanCards.set(this.hebrewKanbanCards().filter(c => c.id !== cardId));
  }

  onHebrewKanbanColumnAdded(col: Omit<KanbanColumn, 'id'>) {
    const newCol: KanbanColumn = {
      ...col,
      id: `hcol-${Date.now()}`,
    };
    this.hebrewKanbanColumns.set([...this.hebrewKanbanColumns(), newCol]);
  }

  onHebrewKanbanColumnUpdated(col: KanbanColumn) {
    this.hebrewKanbanColumns.set(this.hebrewKanbanColumns().map(c => c.id === col.id ? col : c));
  }

  onHebrewKanbanColumnDeleted(event: KanbanColumnDeleteEvent) {
    if (event.moveCardsTo) {
      const movedCards = this.hebrewKanbanCards().map(c =>
        c.columnId === event.columnId ? { ...c, columnId: event.moveCardsTo! } : c
      );
      this.hebrewKanbanCards.set(movedCards);
    } else {
      this.hebrewKanbanCards.set(this.hebrewKanbanCards().filter(c => c.columnId !== event.columnId));
    }
    this.hebrewKanbanColumns.set(this.hebrewKanbanColumns().filter(c => c.id !== event.columnId));
  }

  onHebrewKanbanHistoryChange(state: KanbanHistoryState) {
    this.hebrewKanbanHistory.set(state);
  }
}
