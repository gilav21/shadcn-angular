/**
 * @title Searchable command palette
 * @summary Ctrl+K opens a filterable action list; picking one runs it and closes the dialog.
 * @components command, button, kbd
 */
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ButtonComponent } from '@/components/ui/button';
import { KbdComponent } from '@/components/ui/kbd';
import {
    CommandComponent,
    CommandDialogComponent,
    CommandEmptyComponent,
    CommandGroupComponent,
    CommandInputComponent,
    CommandItemComponent,
    CommandListComponent,
} from '@/components/ui/command';

interface PaletteAction {
    readonly id: string;
    readonly label: string;
    readonly group: string;
}

/**
 * The keyboard entry point power users look for first.
 *
 * `ui-command-dialog` is `ui-command` inside a modal, so the filtering,
 * highlight and Enter-to-select behaviour is the same whether the palette is
 * inline or in an overlay. Bind `open` two-way and drive it from a host
 * keydown listener; the dialog handles Escape itself.
 */
@Component({
    selector: 'app-searchable-command-palette',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ButtonComponent,
        KbdComponent,
        CommandComponent,
        CommandDialogComponent,
        CommandEmptyComponent,
        CommandGroupComponent,
        CommandInputComponent,
        CommandItemComponent,
        CommandListComponent,
    ],
    template: `
    <ui-button variant="outline" (clicked)="open.set(true)" data-testid="open-palette">
      Search actions
      <ui-kbd class="ms-2">Ctrl K</ui-kbd>
    </ui-button>

    <ui-command-dialog [(open)]="open">
      <ui-command>
        <ui-command-input placeholder="Type a command…" />
        <ui-command-list>
          <ui-command-empty>Nothing matches that.</ui-command-empty>
          @for (group of groups; track group) {
            <ui-command-group [heading]="group">
              @for (action of actionsIn(group); track action.id) {
                <ui-command-item [value]="action.label" (selectItem)="run(action)">
                  {{ action.label }}
                </ui-command-item>
              }
            </ui-command-group>
          }
        </ui-command-list>
      </ui-command>
    </ui-command-dialog>

    <p data-testid="last-action">{{ lastAction() }}</p>
  `,
})
export class SearchableCommandPaletteComponent {
    protected readonly open = signal(false);
    protected readonly lastAction = signal('');

    protected readonly actions: readonly PaletteAction[] = [
        { id: 'new', label: 'New document', group: 'Create' },
        { id: 'invite', label: 'Invite teammate', group: 'Create' },
        { id: 'theme', label: 'Toggle dark mode', group: 'Preferences' },
        { id: 'shortcuts', label: 'Keyboard shortcuts', group: 'Preferences' },
    ];

    protected readonly groups: readonly string[] = ['Create', 'Preferences'];

    protected actionsIn(group: string): readonly PaletteAction[] {
        return this.actions.filter(action => action.group === group);
    }

    protected run(action: PaletteAction): void {
        this.lastAction.set(action.id);
        this.open.set(false);
    }
}
