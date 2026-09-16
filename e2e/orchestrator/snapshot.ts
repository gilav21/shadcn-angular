import fs from 'node:fs';

/**
 * Makes `dir` a snapshot of the source identified by `key`, taking it again
 * unless the one on disk was completed for that same key.
 *
 * The key lives in a sibling `<dir>.key` file rather than inside the snapshot,
 * because a snapshot is copied wholesale into each fixture clone. It is written
 * only after `take` resolves, so a copy interrupted half way is never trusted.
 *
 * The rule this exists for: a snapshot must describe the source as committed
 * NOW. The first version took it once and kept it while the directory existed,
 * so the clone workers restored an Aug 21 fixture for weeks — including its old
 * 1 MB bundle budget, which failed the first rte package release on pkg-mixed
 * while pkg-rte, on the canonical fixture, passed.
 */
export async function ensureSnapshot(
    dir: string,
    key: string,
    take: (dir: string) => Promise<void>,
): Promise<void> {
    const keyFile = `${dir}.key`;
    if (fs.existsSync(dir) && readKey(keyFile) === key) return;

    fs.rmSync(keyFile, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
    await take(dir);
    fs.writeFileSync(keyFile, key);
}

function readKey(keyFile: string): string | undefined {
    try {
        return fs.readFileSync(keyFile, 'utf-8');
    } catch {
        // No key file: a snapshot from before keys existed, or an interrupted one.
        return undefined;
    }
}
