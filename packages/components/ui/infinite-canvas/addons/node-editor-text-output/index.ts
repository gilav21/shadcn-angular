/**
 * The general text sink.
 *
 * One display that takes text and how to draw it, rather than a growing family
 * of `colorText` / `boldText` / `alignText` nodes. Style arrives as data, so
 * everything the graph can compose it can also ask for — which is what lets a
 * user build "colour this text" out of `Set field` instead of waiting for
 * someone to write a node for it.
 *
 * An edge, not a middle: this is the boundary where graph data becomes a
 * document, so it is also where the checking lives. See
 * `node-editor-text-output.types` for what a style value has to satisfy before
 * it reaches CSS.
 */
export * from './node-editor-text-output.component';
export * from './node-editor-text-output.types';
