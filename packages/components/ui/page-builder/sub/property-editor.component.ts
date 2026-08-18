import {
    Component,
    ChangeDetectionStrategy,
    input,
    output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardItem } from '../../bento-grid';
import { ComponentMeta } from '../../../lib/page-builder.types';
import { SwitchComponent } from '../../switch';
import {
    SelectComponent,
    SelectTriggerComponent,
    SelectValueComponent,
    SelectContentComponent,
    SelectItemComponent
} from '../../select';
import { IconComponent } from '../../icon';

@Component({
    selector: 'ui-property-editor',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        SwitchComponent,
        SelectComponent,
        SelectTriggerComponent,
        SelectValueComponent,
        SelectContentComponent,
        SelectItemComponent,
        IconComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './property-editor.component.html',
})
export class PropertyEditorComponent {
    /** The widget being edited. `undefined` renders the empty state; the editor never mutates it, it only emits {@link itemChange}. */
    item = input<DashboardItem | undefined>(undefined);
    /** Describes which inputs to offer and with what control. Supply it from the builder's resolver so types come from the live instance; without it only the geometry fields are editable. */
    componentMeta = input<ComponentMeta | undefined>(undefined);
    /** Shows the skeleton/placeholder state while the widget's metadata is still being resolved. Purely visual — the controls are not disabled. */
    isLoading = input<boolean>(false);

    /**
     * One edit, as `{ id, prop, value }`. The editor is fully controlled: nothing
     * changes until the parent applies this and feeds a new {@link item} back.
     * `prop` is `'bindings'` for the whole bindings map, a geometry field
     * (`x`/`y`/`cols`/`rows`), or otherwise a component input name.
     */
    itemChange = output<{ id: string, prop: string, value: unknown }>();
    /** The user asked to remove the widget. Carries no id — the parent deletes whatever is selected, which is this {@link item}. */
    delete = output<void>();

    /** Reads a component input's current value off the widget. Returns undefined when unset, so the control falls back to its own default rather than showing the declared one. */
    getItemInput(name: string): unknown {
        return this.item()?.inputs?.[name];
    }

    /** Reads a component input coerced to boolean for the switch controls. Any unset value reads false — a tri-state input cannot be represented. */
    getItemInputAsBoolean(name: string): boolean {
        return !!this.item()?.inputs?.[name];
    }

    /** Emits a change to a geometry/structural field (`x`, `y`, `cols`, `rows`). Silently ignored when no widget is selected. */
    onPropertyChange(prop: string, value: unknown): void {
        const item = this.item();
        if (!item) return;
        this.itemChange.emit({ id: item.id, prop, value });
    }

    /** Emits a change to one of the widget's component inputs. Identical in shape to {@link onPropertyChange} — the parent decides, from the name, whether it lands on the item or in `inputs`. */
    onInputChange(name: string, value: unknown): void {
        const item = this.item();
        if (!item) return;
        this.itemChange.emit({ id: item.id, prop: name, value });
    }

    // Binding Helpers
    /** Whether this input is driven by a binding expression rather than a literal. Note an empty binding string reads as *not* bound, so a freshly toggled, still-blank binding shows as off. */
    hasBinding(name: string): boolean {
        return !!this.item()?.bindings?.[name];
    }

    /** The binding expression for an input, or `''` when it has none — safe to bind straight to a text field. */
    getBinding(name: string): string {
        return this.item()?.bindings?.[name] ?? '';
    }

    /**
     * Switches an input between literal and bound, emitting the whole rewritten
     * bindings map as `prop: 'bindings'`. Turning binding on seeds an empty
     * expression; turning it off deletes the entry and the input falls back to
     * its literal value, which was kept untouched all along.
     */
    toggleBinding(name: string): void {
        const item = this.item();
        if (!item) return;

        const currentBindings = item.bindings ?? {};
        const newBindings = { ...currentBindings };

        if (this.hasBinding(name)) {
            delete newBindings[name];
        } else {
            newBindings[name] = '';
        }

        this.itemChange.emit({ id: item.id, prop: 'bindings', value: newBindings });
    }

    /** Emits the bindings map with one expression rewritten. The expression is stored verbatim and never validated here. */
    onBindingChange(name: string, value: string): void {
        const item = this.item();
        if (!item) return;

        const currentBindings = item.bindings ?? {};
        const newBindings = { ...currentBindings, [name]: value };

        this.itemChange.emit({ id: item.id, prop: 'bindings', value: newBindings });
    }
}
