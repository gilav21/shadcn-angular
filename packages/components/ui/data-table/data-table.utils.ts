export function buildTreeFromFlat<T>(
    rows: T[],
    getId: (row: T) => string,
    getParentId: (row: T) => string | null,
    setChildren: (row: T, children: T[]) => T
): T[] {
    const childrenMap = new Map<string | null, T[]>();

    for (const row of rows) {
        const parentId = getParentId(row);
        const siblings = childrenMap.get(parentId);
        if (siblings) {
            siblings.push(row);
        } else {
            childrenMap.set(parentId, [row]);
        }
    }

    function attachChildren(row: T): T {
        const id = getId(row);
        const children = childrenMap.get(id);
        if (!children || children.length === 0) {
            return row;
        }
        return setChildren(row, children.map(attachChildren));
    }

    const roots = childrenMap.get(null) ?? [];
    return roots.map(attachChildren);
}
