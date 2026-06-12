import { Type } from '@angular/core';

export type InputType = 'string' | 'number' | 'boolean' | 'select' | 'json' | 'color';

export type PageBuilderViewMode = 'edit' | 'preview';

export interface InputDefinition {
    name: string;
    type: InputType;
    label?: string;
    options?: string[]; // For select type
    defaultValue?: unknown;
}

export interface PageGridConfig {
    cols: number;
    rowHeight: string;
    columnWidth: string;
    gap: string;
    showBorders?: boolean;
    borderRadius: string;
    itemPadding: string;
    squareCells?: boolean;
}

export interface PageItemData {
    id: string;
    x: number;
    y: number;
    cols: number;
    rows: number;
    componentId: string;
    inputs?: Record<string, unknown>;
    bindings?: Record<string, string>; // Maps input name -> context path (e.g. 'title' -> 'user.name')
}

export interface PageData {
    grid: PageGridConfig;
    items: PageItemData[];
    timestamp?: string;
}

export interface ComponentMeta {
    id: string; // Unique ID for the registry
    name: string; // Display name
    description?: string;
    category: string;
    component: Type<unknown>;
    icon?: string; // Lucide icon name
    defaultInputs?: Record<string, unknown>;
    inputs?: InputDefinition[]; // Schema for the property editor
    defaultCols?: number;
    defaultRows?: number;
}

export interface PageBuilderConfig {
    components: ComponentMeta[];
}


// --- File System Access API Types ---

export interface FileSystemWritableFileStream extends WritableStream {
    write(data: unknown): Promise<void>;
    seek(position: number): Promise<void>;
    truncate(size: number): Promise<void>;
}

export interface FileSystemFileHandle {
    kind: 'file';
    name: string;
    createWritable(options?: Record<string, unknown>): Promise<FileSystemWritableFileStream>;
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

export interface OpenFilePickerOptions {
    multiple?: boolean;
    types?: {
        description?: string;
        accept: Record<string, string[]>;
    }[];
    excludeAcceptAllOption?: boolean;
}

export interface WindowWithFileSystem extends Window {
    showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
    showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
}
