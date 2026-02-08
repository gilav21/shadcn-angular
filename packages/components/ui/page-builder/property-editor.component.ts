import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    NgModule
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
    LucideAngularModule,
    Box,
    Columns2,
    Rows2,
    Trash2,
    MousePointerClick
} from 'lucide-angular';
import { DashboardItem } from '../bento-grid.component';
import { ComponentMeta } from './page-builder.types';
import { SwitchComponent } from '../switch.component';
import {
    SelectComponent,
    SelectTriggerComponent,
    SelectValueComponent,
    SelectContentComponent,
    SelectItemComponent
} from '../select.component';

@NgModule({
    imports: [
        LucideAngularModule.pick({
            Box,
            Columns2,
            Rows2,
            Trash2,
            MousePointerClick
        })
    ],
    exports: [LucideAngularModule]
})
export class PropertyEditorIconsModule { }

@Component({
    selector: 'ui-property-editor',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        PropertyEditorIconsModule,
        SwitchComponent,
        SelectComponent,
        SelectTriggerComponent,
        SelectValueComponent,
        SelectContentComponent,
        SelectItemComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div class="h-full flex flex-col bg-background">
        <!-- We removed the header from here because the parent now handles the main header -->
        
        <div class="flex-1 overflow-y-auto">
            @if (item()) {
                <div class="p-6 space-y-8">
                    <!-- Loading State -->
                    @if (isLoading()) {
                        <div class="space-y-6 animate-pulse">
                            <div class="flex items-start gap-4 p-4 rounded-xl border bg-card/10">
                                <div class="h-12 w-12 rounded-lg bg-muted shrink-0"></div>
                                <div class="flex-1 space-y-2 py-1">
                                    <div class="h-4 bg-muted rounded w-3/4"></div>
                                    <div class="h-3 bg-muted rounded w-1/2"></div>
                                </div>
                            </div>
                            <div class="space-y-4">
                                <div class="h-4 bg-muted rounded w-1/4"></div>
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="h-10 bg-muted rounded"></div>
                                    <div class="h-10 bg-muted rounded"></div>
                                </div>
                            </div>
                            <div class="space-y-4 pt-4">
                                <div class="h-4 bg-muted rounded w-1/3"></div>
                                <div class="space-y-3">
                                    <div class="h-10 bg-muted rounded"></div>
                                    <div class="h-10 bg-muted rounded"></div>
                                    <div class="h-10 bg-muted rounded"></div>
                                </div>
                            </div>
                        </div>
                    } @else {
                        <!-- Selected Component Header -->
                        <div class="flex items-start gap-4 p-4 rounded-xl border bg-card/50">
                            <div class="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <lucide-icon [name]="componentMeta()?.icon || 'box'" class="h-6 w-6 text-primary" />
                            </div>
                            <div class="flex-1 min-w-0">
                                <h3 class="font-semibold text-lg leading-tight truncate">{{ componentMeta()?.name }}</h3>
                                <p class="text-xs text-muted-foreground font-mono mt-1 truncate">{{ item()!.id }}</p>
                            </div>
                        </div>

                        <!-- Basic Layout Properties -->
                        <div class="space-y-4">
                            <div class="flex items-center justify-between">
                                 <h4 class="text-sm font-semibold text-foreground">Layout</h4>
                                 <span class="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Grid Config</span>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div class="space-y-1.5">
                                    <label class="text-xs font-medium text-muted-foreground">Columns (Width)</label>
                                    <div class="relative">
                                        <input 
                                            type="number" 
                                            [ngModel]="item()!.cols" 
                                            (ngModelChange)="onPropertyChange('cols', $event)"
                                            class="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pl-9"
                                            min="1" max="12"
                                        />
                                        <div class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                            <lucide-icon name="columns-2" class="h-4 w-4" />
                                        </div>
                                    </div>
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-medium text-muted-foreground">Rows (Height)</label>
                                    <div class="relative">
                                        <input 
                                            type="number" 
                                            [ngModel]="item()!.rows" 
                                            (ngModelChange)="onPropertyChange('rows', $event)"
                                            class="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pl-9"
                                            min="1"
                                        />
                                        <div class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                            <lucide-icon name="rows-2" class="h-4 w-4" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="h-px bg-border"></div>

                        <!-- Component Specific Inputs -->
                        @if (componentMeta()?.inputs?.length) {
                            <div class="space-y-4">
                                <div class="flex items-center justify-between">
                                    <h4 class="text-sm font-semibold text-foreground">Settings</h4>
                                    <span class="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Props</span>
                               </div>
                                
                                @for (inputDef of componentMeta()?.inputs; track inputDef.name) {
                                <div class="space-y-2">
                                    <label class="text-xs font-medium text-foreground block">
                                        {{ inputDef.label || inputDef.name }}
                                    </label>
                                    @switch (inputDef.type) {
                                        @case ('boolean') {
                                            <div class="flex items-center justify-between h-10 px-3 rounded-md border bg-card/50">
                                                <span class="text-sm font-medium text-foreground">{{ inputDef.label || inputDef.name }}</span>
                                                <ui-switch 
                                                    [checked]="getItemInput(inputDef.name)" 
                                                    (checkedChange)="onInputChange(inputDef.name, $event)"
                                                />
                                            </div>
                                        }
                                        @case ('select') {
                                            <ui-select 
                                                [value]="getItemInput(inputDef.name)"
                                                (valueChange)="onInputChange(inputDef.name, $event)"
                                                [options]="inputDef.options || []"
                                                [placeholder]="'Select ' + (inputDef.label || inputDef.name)"
                                            >
                                                <ui-select-trigger class="w-full">
                                                    <ui-select-value />
                                                </ui-select-trigger>
                                                <ui-select-content>
                                                    @for (opt of inputDef.options; track opt) {
                                                        <ui-select-item [value]="opt">{{ opt }}</ui-select-item>
                                                    }
                                                </ui-select-content>
                                            </ui-select>
                                        }
                                        @default {
                                            <input 
                                                [type]="inputDef.type === 'number' ? 'number' : 'text'"
                                                [ngModel]="getItemInput(inputDef.name)"
                                                (ngModelChange)="onInputChange(inputDef.name, $event)"
                                                class="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            />
                                        }
                                    }
                                </div>
                                }
                            </div>
                            
                            <div class="h-px bg-border"></div>
                        }
                        
                        <div class="pt-2">
                            <button 
                            class="w-full flex items-center justify-center gap-2 h-10 rounded-md bg-destructive/5 text-destructive hover:bg-destructive/15 border border-destructive/20 hover:border-destructive/30 text-sm font-medium transition-all"
                            (click)="delete.emit()"
                            >
                                <lucide-icon name="trash-2" class="h-4 w-4" />
                                Delete Component
                            </button>
                        </div>
                    }

                </div>
            } @else {
                <div class="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center bg-muted/5">
                    <div class="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-6">
                        <lucide-icon name="mouse-pointer-click" class="h-10 w-10 opacity-50" />
                    </div>
                    <h3 class="font-medium text-foreground mb-2">No Selection</h3>
                    <p class="text-sm max-w-[200px]">Select an item on the board to edit its layout and properties.</p>
                </div>
            }
        </div>
    </div>
  `
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
}
