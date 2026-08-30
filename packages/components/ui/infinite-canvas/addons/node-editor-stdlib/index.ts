/**
 * A standard library of node types.
 *
 * ### Why this exists
 *
 * The editor could always RUN a graph; what it could not do was give anyone
 * something to put in one. Every node type was written by a developer, so a
 * user building a subgraph could only wire together whatever the application
 * happened to ship — and a subgraph you cannot fill is not a transformer
 * builder, it is a folder.
 *
 * These are the pieces you compose FROM. All pure, all viewless, all a
 * function of their inputs.
 *
 * ### The line this library draws
 *
 * The middle of a graph is data, and that is what is here. The edges are not:
 * sources that fetch and sinks that render stay application code, because
 * rendering is unbounded and letting a graph describe it means inventing a UI
 * language. So there is no "text input" and no "display" in this library —
 * `node-editor-text-output` is the deliberately general sink, and an
 * application brings its own sources.
 *
 * That split is what keeps the toolbox composable without it becoming a
 * programming language: no loops, no recursion, no conditional execution.
 * `Select` picks between two values that both already exist, which is still
 * dataflow.
 */
export * from './node-editor-stdlib.coerce';
export * from './node-editor-stdlib.text';
export * from './node-editor-stdlib.number';
export * from './node-editor-stdlib.logic';
export * from './node-editor-stdlib.object';
export * from './node-editor-stdlib.list';
export * from './node-editor-stdlib.convert';

import type { NodeTypeDefinition } from '../node-editor';
import { STD_TEXT_NODES } from './node-editor-stdlib.text';
import { STD_NUMBER_NODES } from './node-editor-stdlib.number';
import { STD_LOGIC_NODES } from './node-editor-stdlib.logic';
import { STD_OBJECT_NODES } from './node-editor-stdlib.object';
import { STD_LIST_NODES } from './node-editor-stdlib.list';
import { STD_CONVERT_NODES } from './node-editor-stdlib.convert';

/**
 * Every node type in the library.
 *
 * Pass to the editor's `definitions`, and to a subgraph type's `definitions`
 * so the toolbox is available inside nested graphs too.
 */
export const STDLIB_NODE_TYPES: readonly NodeTypeDefinition[] = [
  ...STD_TEXT_NODES,
  ...STD_NUMBER_NODES,
  ...STD_LOGIC_NODES,
  ...STD_OBJECT_NODES,
  ...STD_LIST_NODES,
  ...STD_CONVERT_NODES,
];
