import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialHash } from './infinite-canvas.spatial-hash';
import type { CanvasItem, CanvasRect } from './infinite-canvas.types';

function item(id: string | number, x: number, y: number, width = 10, height = 10): CanvasItem {
  return { id, x, y, width, height };
}

function ids(items: readonly CanvasItem[]): (string | number)[] {
  return items.map(i => i.id).sort((a, b) => String(a).localeCompare(String(b)));
}

/** Reference implementation: the O(n) scan the hash must agree with exactly. */
function linearQuery(items: readonly CanvasItem[], rect: CanvasRect): CanvasItem[] {
  return items.filter(
    i =>
      i.x <= rect.x + rect.width &&
      rect.x <= i.x + i.width &&
      i.y <= rect.y + rect.height &&
      rect.y <= i.y + i.height,
  );
}

describe('SpatialHash', () => {
  let hash: SpatialHash<CanvasItem>;

  beforeEach(() => {
    hash = new SpatialHash<CanvasItem>(100);
  });

  describe('construction', () => {
    it('starts empty', () => {
      expect(hash.size).toBe(0);
      expect(hash.query({ x: -1e6, y: -1e6, width: 2e6, height: 2e6 })).toEqual([]);
    });

    it('rejects a non-positive cell size rather than dividing by zero', () => {
      expect(() => new SpatialHash<CanvasItem>(0)).toThrow();
      expect(() => new SpatialHash<CanvasItem>(-5)).toThrow();
    });
  });

  describe('insert and query', () => {
    it('finds an item overlapping the query rect', () => {
      hash.insert(item('a', 10, 10));
      expect(ids(hash.query({ x: 0, y: 0, width: 50, height: 50 }))).toEqual(['a']);
    });

    it('excludes an item outside the query rect', () => {
      hash.insert(item('a', 500, 500));
      expect(hash.query({ x: 0, y: 0, width: 50, height: 50 })).toEqual([]);
    });

    it('finds an item that only partially overlaps', () => {
      hash.insert(item('a', 45, 45, 20, 20));
      expect(ids(hash.query({ x: 0, y: 0, width: 50, height: 50 }))).toEqual(['a']);
    });

    it('finds an item much larger than one cell', () => {
      hash.insert(item('big', -500, -500, 1000, 1000));
      expect(ids(hash.query({ x: 0, y: 0, width: 1, height: 1 }))).toEqual(['big']);
    });

    it('returns an item spanning several cells exactly once', () => {
      hash.insert(item('wide', 0, 0, 350, 350));
      expect(hash.query({ x: -10, y: -10, width: 400, height: 400 })).toHaveLength(1);
    });

    it('handles negative world coordinates', () => {
      hash.insert(item('neg', -250, -250));
      expect(ids(hash.query({ x: -300, y: -300, width: 100, height: 100 }))).toEqual(['neg']);
    });

    it('keeps items that share one coordinate distinct (edge case)', () => {
      hash.insert(item('a', 0, 0));
      hash.insert(item('b', 0, 0));
      hash.insert(item('c', 0, 0));

      expect(hash.size).toBe(3);
      expect(ids(hash.query({ x: 0, y: 0, width: 1, height: 1 }))).toEqual(['a', 'b', 'c']);
    });

    it('supports zero-size items', () => {
      hash.insert(item('point', 30, 30, 0, 0));
      expect(ids(hash.query({ x: 25, y: 25, width: 10, height: 10 }))).toEqual(['point']);
    });

    it('supports coordinates far from the origin', () => {
      hash.insert(item('far', 1e7, -1e7));
      expect(ids(hash.query({ x: 1e7 - 5, y: -1e7 - 5, width: 20, height: 20 }))).toEqual(['far']);
    });

    it('replaces an item re-inserted under the same id', () => {
      hash.insert(item('a', 0, 0));
      hash.insert(item('a', 900, 900));

      expect(hash.size).toBe(1);
      expect(hash.query({ x: 0, y: 0, width: 50, height: 50 })).toEqual([]);
      expect(ids(hash.query({ x: 880, y: 880, width: 50, height: 50 }))).toEqual(['a']);
    });
  });

  describe('move', () => {
    it('relocates an item without leaving a ghost in the old cell', () => {
      const moving = item('a', 0, 0);
      hash.insert(moving);

      hash.move({ ...moving, x: 800, y: 800 });

      expect(hash.query({ x: -10, y: -10, width: 60, height: 60 })).toEqual([]);
      expect(ids(hash.query({ x: 790, y: 790, width: 40, height: 40 }))).toEqual(['a']);
      expect(hash.size).toBe(1);
    });

    it('is a no-op-safe insert for an unknown id', () => {
      hash.move(item('ghost', 5, 5));
      expect(ids(hash.query({ x: 0, y: 0, width: 20, height: 20 }))).toEqual(['ghost']);
    });

    it('survives repeated moves without growing the index', () => {
      const moving = item('a', 0, 0);
      hash.insert(moving);
      for (let i = 0; i < 500; i++) hash.move({ ...moving, x: i * 7, y: i * 3 });

      expect(hash.size).toBe(1);
      expect(hash.cellCount).toBeLessThanOrEqual(4);
    });
  });

  describe('remove and clear', () => {
    it('removes an item', () => {
      hash.insert(item('a', 0, 0));
      expect(hash.remove('a')).toBe(true);
      expect(hash.size).toBe(0);
      expect(hash.query({ x: 0, y: 0, width: 50, height: 50 })).toEqual([]);
    });

    it('reports removal of an unknown id as false', () => {
      expect(hash.remove('nope')).toBe(false);
    });

    it('frees the cell buckets it emptied', () => {
      hash.insert(item('a', 0, 0));
      hash.remove('a');
      expect(hash.cellCount).toBe(0);
    });

    it('clear() empties everything', () => {
      for (let i = 0; i < 50; i++) hash.insert(item(i, i * 40, i * 40));
      hash.clear();

      expect(hash.size).toBe(0);
      expect(hash.cellCount).toBe(0);
    });

    it('rebuild() replaces the contents wholesale', () => {
      hash.insert(item('old', 0, 0));
      hash.rebuild([item('new', 0, 0)]);

      expect(hash.size).toBe(1);
      expect(ids(hash.query({ x: 0, y: 0, width: 10, height: 10 }))).toEqual(['new']);
    });
  });

  describe('queryPoint', () => {
    it('returns items containing the point', () => {
      hash.insert(item('a', 0, 0, 100, 100));
      hash.insert(item('b', 200, 200, 10, 10));

      expect(ids(hash.queryPoint(50, 50))).toEqual(['a']);
      expect(hash.queryPoint(150, 150)).toEqual([]);
    });

    it('returns every overlapping item when they are stacked', () => {
      hash.insert(item('a', 0, 0, 100, 100));
      hash.insert(item('b', 10, 10, 20, 20));

      expect(ids(hash.queryPoint(15, 15))).toEqual(['a', 'b']);
    });
  });

  describe('agreement with a linear scan (this is the correctness contract)', () => {
    it('matches an O(n) filter over 2,000 pseudo-random items for many rects', () => {
      const items: CanvasItem[] = [];
      let seed = 20260820;
      const random = (): number => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
      };

      for (let i = 0; i < 2000; i++) {
        items.push(item(i, random() * 8000 - 4000, random() * 8000 - 4000, 20 + random() * 180, 20 + random() * 180));
      }
      hash.rebuild(items);

      for (let q = 0; q < 40; q++) {
        const rect: CanvasRect = {
          x: random() * 8000 - 4000,
          y: random() * 8000 - 4000,
          width: 50 + random() * 1500,
          height: 50 + random() * 1500,
        };
        expect(ids(hash.query(rect))).toEqual(ids(linearQuery(items, rect)));
      }
    });
  });

  describe('scale', () => {
    it('holds 10,000 items and returns only the visible slice', () => {
      const items: CanvasItem[] = [];
      for (let i = 0; i < 10_000; i++) {
        items.push(item(i, (i % 100) * 200, Math.floor(i / 100) * 200, 120, 80));
      }
      hash.rebuild(items);

      expect(hash.size).toBe(10_000);

      const visible = hash.query({ x: 0, y: 0, width: 1200, height: 800 });
      expect(visible.length).toBeGreaterThan(0);
      expect(visible.length).toBeLessThan(100);
    });
  });
});
