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


// --- File System Access API Types ---

export interface FileSystemWritableFileStream extends WritableStream {
    write(data: any): Promise<void>;
    seek(position: number): Promise<void>;
    truncate(size: number): Promise<void>;
}

export interface FileSystemFileHandle {
    kind: 'file';
    name: string;
    createWritable(options?: any): Promise<FileSystemWritableFileStream>;
    getFile(): Promise<File>;
}

export interface SaveFilePickerOptions {
    suggestedName?: string;
    types?: {
        description?: string;
        accept: Record<string, string[]>;
    }[];
    excludeAcceptAllOption?: boolean;
}

export interface WindowWithFileSystem extends Window {
    showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
}
