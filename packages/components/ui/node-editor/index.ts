/**
 * Re-exported from the engine so an addon can talk in world coordinates
 * without importing past its parent — which is what breaks sync-registry's
 * component-boundary detection.
 */
export type { CanvasPoint, CanvasRect, CanvasViewport } from '../infinite-canvas';
export * from './node-editor.component';
export * from './node-editor-node.directive';
export * from './node-editor.graph';
export * from './node-editor.history';
export * from './node-editor.serialize';
export * from './node-editor.layout';
export * from './node-editor.materialize';
export * from './node-editor.runtime';
export * from './node-editor.runtime.types';
export * from './node-editor.types';
export * from './node-editor.validate';
export * from './sub/node-editor-node.component';
export * from './sub/node-editor-port.component';
