import { Type } from '@angular/core';

export type InputType = 'string' | 'number' | 'boolean' | 'select' | 'json' | 'color';

export interface InputDefinition {
    name: string;
    type: InputType;
    label?: string;
    options?: string[]; // For select type
    defaultValue?: any;
}

export interface ComponentMeta {
    id: string; // Unique ID for the registry
    name: string; // Display name
    description?: string;
    category: string;
    component: Type<any>;
    icon?: string; // Lucide icon name
    defaultInputs?: Record<string, any>;
    inputs?: InputDefinition[]; // Schema for the property editor
    defaultCols?: number;
    defaultRows?: number;
}

export interface PageBuilderConfig {
    components: ComponentMeta[];
}
