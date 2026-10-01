/** One entry in either list of a `<ui-field-mapper>`. */
export interface FieldMapperItem {
    /** Unique within its own list. The two lists may reuse each other's ids. */
    readonly id: string;
    /** Accessible name, and what the item shows when no item template is given. */
    readonly label: string;
    /** A disabled item stays visible but can never be linked. */
    readonly disabled?: boolean;
}

/** A line between a start item and an end item. */
export interface FieldMapperLink {
    readonly startId: string;
    readonly endId: string;
}

/** Which of the two lists an item belongs to. `start` is on the left in LTR and on the right in RTL. */
export type FieldMapperSide = 'start' | 'end';

/**
 * How many links an item on each side may hold. Omitted sides default to 1;
 * `Infinity` allows any number.
 */
export interface FieldMapperMaxLinks {
    readonly start?: number;
    readonly end?: number;
}

/** `auto` picks columns or rows from the component's own width; the others force one. */
export type FieldMapperLayout = 'auto' | 'columns' | 'rows';

/**
 * How a line is drawn. Each tone differs in dash pattern or weight as well as
 * colour, so it never relies on colour alone.
 */
export type FieldMapperLinkTone = 'default' | 'muted' | 'strong';

/** Context of the `uiFieldMapperItem` template. */
export interface FieldMapperItemContext {
    readonly $implicit: FieldMapperItem;
    readonly side: FieldMapperSide;
    /** Whether the item currently holds at least one link. */
    readonly linked: boolean;
}

/** Context of the `uiFieldMapperLinkLabel` template. */
export interface FieldMapperLinkLabelContext {
    readonly $implicit: FieldMapperLink;
    readonly start: FieldMapperItem;
    readonly end: FieldMapperItem;
}
