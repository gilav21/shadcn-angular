/**
 * Working out what a right-click landed on.
 *
 * Kept as a pure function, apart from the directive, because it is the part
 * with all the judgement in it — three different mechanisms answer for three
 * different things, and each is worth being able to test on its own.
 */
import type { CanvasPoint, NodeEditorComponent } from '../node-editor';
import type { NodeEditorContextTarget } from './node-editor-context-menu.types';

/**
 * Where a gesture landed.
 *
 * A `MouseEvent` satisfies this as-is; a long-press supplies it from
 * `touches[0]`, which is how the same resolution serves both without the
 * caller pretending a touch is a mouse.
 */
export interface ContextPointer {
  readonly target: EventTarget | null;
  readonly clientX: number;
  readonly clientY: number;
}

/** The editor surface a resolve needs. Narrow, so a test can stand one up. */
export interface ContextMenuEditor {
  toWorld: NodeEditorComponent['toWorld'];
  hitTest: NodeEditorComponent['hitTest'];
  renderedNodes: NodeEditorComponent['renderedNodes'];
  connections: NodeEditorComponent['connections'];
}

/** The port branch, extracted: three lookups that can each come up empty. */
function resolvePort(
  element: Element,
  editor: ContextMenuEditor,
  at: CanvasPoint,
  screen: CanvasPoint,
): NodeEditorContextTarget | null {
  const portElement = element.closest<HTMLElement>('[data-slot="node-editor-port"]');
  const portId = portElement?.dataset['port'];
  const nodeId = portElement?.dataset['node'];
  if (portId === undefined || nodeId === undefined) return null;

  const node = editor.renderedNodes().find(candidate => String(candidate.id) === nodeId);
  const port = node?.ports?.find(candidate => candidate.id === portId);
  if (!node || !port) return null;

  return {
    kind: 'port',
    nodeId: node.id,
    portId,
    direction: port.direction,
    // Both ends, so "disconnect" knows exactly what it would remove without
    // the consumer having to work it out again.
    connections: editor
      .connections()
      .filter(
        connection =>
          (connection.target === node.id && connection.targetPort === portId) ||
          (connection.source === node.id && connection.sourcePort === portId),
      ),
    at,
    screen,
  };
}

/**
 * What was right-clicked, or `null` when nothing here can answer.
 *
 * Resolution runs most-specific first — port, then node, then wire, then plane
 * — because a port sits inside a node's box and a node sits on the plane, so
 * any other order answers with the container instead of the thing.
 */
export function resolveTarget(
  event: ContextPointer,
  editor: ContextMenuEditor,
): NodeEditorContextTarget | null {
  const element = event.target as Element | null;
  if (!element) return null;

  const screen = { x: event.clientX, y: event.clientY };
  const at = editor.toWorld(screen);

  const port = resolvePort(element, editor, at, screen);
  if (port) return port;

  const cardElement = element.closest<HTMLElement>('[data-slot="node-editor-node"]');
  if (cardElement) {
    const nodeId = cardElement.dataset['node'];
    const node = editor.renderedNodes().find(candidate => String(candidate.id) === nodeId);
    if (node) return { kind: 'node', nodeId: node.id, node, at, screen };
  }

  /*
   * Only now the canvas hit test, and only for wires.
   *
   * Connections are painted into one shared canvas, so nothing in the DOM
   * knows one is under the pointer — this is the only way to find them. It is
   * asked last because it also answers "item", and a node card has already
   * given a better answer above.
   */
  const hit = editor.hitTest(screen);
  if (hit?.kind === 'connection') {
    const connection = editor.connections().find(candidate => candidate.id === hit.id);
    if (connection) return { kind: 'connection', connection, at, screen };
  }

  // Nothing but plane. Still a target: it is where "add a node" belongs.
  if (element.closest('[data-slot="node-editor"]')) {
    return { kind: 'canvas', at, screen };
  }
  return null;
}
