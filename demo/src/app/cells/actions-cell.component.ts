import { ButtonComponent } from '@/components/ui';
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

@Component({
    selector: 'app-actions-cell',
    standalone: true,
    template: `
    <div class="flex gap-2">
      <ui-button size="sm" variant="outline" (click)="onView()">
        View
      </ui-button>
      <ui-button size="sm" variant="ghost" (click)="onEdit()">
        Edit
      </ui-button>
    </div>
  `,
    imports: [ButtonComponent],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActionsCellComponent {
    id = input.required<string>();
    email = input.required<string>();

    view = output<{ id: string; email: string }>();
    edit = output<{ id: string; email: string }>();

    onView() {
        this.view.emit({ id: this.id(), email: this.email() });
    }

    onEdit() {
        this.edit.emit({ id: this.id(), email: this.email() });
    }
}
