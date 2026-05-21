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
    item = input<DashboardItem | undefined>(undefined);
    componentMeta = input<ComponentMeta | undefined>(undefined);
    isLoading = input<boolean>(false);

    itemChange = output<{ id: string, prop: string, value: any }>();
    delete = output<void>();

    getItemInput(name: string): any {
        return this.item()?.inputs?.[name];
    }

    onPropertyChange(prop: string, value: any) {
        const item = this.item();
        if (!item) return;
        this.itemChange.emit({ id: item.id, prop, value });
    }

    onInputChange(name: string, value: any) {
        const item = this.item();
        if (!item) return;
        this.itemChange.emit({ id: item.id, prop: name, value });
    }

    // Binding Helpers
    hasBinding(name: string): boolean {
        return !!this.item()?.bindings?.[name];
    }

    getBinding(name: string): string {
        return this.item()?.bindings?.[name] || '';
    }

    toggleBinding(name: string) {
        const item = this.item();
        if (!item) return;

        const currentBindings = item.bindings || {};
        const newBindings = { ...currentBindings };

        if (this.hasBinding(name)) {
            delete newBindings[name];
        } else {
            newBindings[name] = '';
        }

        this.itemChange.emit({ id: item.id, prop: 'bindings', value: newBindings });
    }

    onBindingChange(name: string, value: string) {
        const item = this.item();
        if (!item) return;

        const currentBindings = item.bindings || {};
        const newBindings = { ...currentBindings, [name]: value };

        this.itemChange.emit({ id: item.id, prop: 'bindings', value: newBindings });
    }
}
