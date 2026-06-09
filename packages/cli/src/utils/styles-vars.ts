import fs from 'fs-extra';
import path from 'node:path';

/**
 * Resolve the CSS file that actually holds the design-token blocks.
 *
 * `init` writes the `:root` / `.dark` token blocks into a `tailwind.css`
 * generated next to the user's configured global styles file, and only adds
 * an `@import "./tailwind.css"` line to the configured file. Commands that
 * read or write tokens therefore can't target `config.tailwind.css` blindly:
 * when the configured file has no `:root` block but a sibling `tailwind.css`
 * exists, the sibling is the token file.
 *
 * @param configuredCssPath - Absolute path of the configured global styles file.
 * @returns The absolute path of the file containing the token blocks.
 */
export async function resolveTokenCssPath(configuredCssPath: string): Promise<string> {
    if (await fs.pathExists(configuredCssPath)) {
        const css = await fs.readFile(configuredCssPath, 'utf-8');
        if (/:root\s*\{/.test(css)) return configuredCssPath;
    }
    const sibling = path.join(path.dirname(configuredCssPath), 'tailwind.css');
    if (sibling !== configuredCssPath && await fs.pathExists(sibling)) {
        return sibling;
    }
    return configuredCssPath;
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegex(str: string): string {
    return str.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replaces a CSS custom property value in a given CSS block string.
 * Handles both uncommented and commented-out vars.
 * Returns the modified block, or null if the var was not found.
 */
function replaceVarInBlock(block: string, varName: string, value: string): string | null {
    const escaped = escapeRegex(varName);

    // First try to match a commented-out var: /* --var-name: old; */
    const commentedPattern = new RegExp(
        `\\/\\*\\s*([ \\t]*${escaped}\\s*:\\s*)[^;]*(;)\\s*\\*\\/`,
        'g',
    );
    if (commentedPattern.test(block)) {
        return block.replace(
            new RegExp(`\\/\\*\\s*([ \\t]*${escaped}\\s*:\\s*)[^;]*(;)\\s*\\*\\/`, 'g'),
            (_match, prefix, semi) => `${prefix}${value}${semi}`,
        );
    }

    // Then try an uncommented var: --var-name: old;
    const uncommentedPattern = new RegExp(`(${escaped}\\s*:\\s*)[^;]*(;)`, 'g');
    if (uncommentedPattern.test(block)) {
        return block.replace(
            new RegExp(`(${escaped}\\s*:\\s*)[^;]*(;)`, 'g'),
            (_match, prefix, semi) => `${prefix}${value}${semi}`,
        );
    }

    return null;
}

/** Removes all CSS block comments so commented-out vars are never matched. */
function stripCssComments(css: string): string {
    return css.replaceAll(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Read a CSS custom property value from a named block in a CSS string.
 * Commented-out declarations are ignored. Returns the trimmed value,
 * or null when the block or the var is not found.
 *
 * @param css      - Full CSS source string.
 * @param selector - CSS selector for the block (e.g. ":root", ".dark").
 * @param varName  - CSS custom property name (e.g. "--density").
 */
export function readBlockVar(css: string, selector: string, varName: string): string | null {
    const escapedSelector = escapeRegex(selector);
    const blockMatch = new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`, 'm').exec(css);
    if (!blockMatch) return null;

    const inner = stripCssComments(blockMatch[1]);
    const varMatch = new RegExp(`(?<![\\w-])${escapeRegex(varName)}\\s*:\\s*([^;]*);`).exec(inner);
    return varMatch ? varMatch[1].trim() : null;
}

/**
 * Read a CSS custom property value from the :root block of a CSS string.
 * Commented-out declarations are ignored. Returns null when not set.
 */
export function readRootVar(css: string, varName: string): string | null {
    return readBlockVar(css, ':root', varName);
}

/**
 * Set a CSS custom property in the :root block of a CSS file.
 * If the property exists (even commented out), updates it.
 * If not found, appends it before the closing } of :root.
 *
 * @param cssPath - Absolute path to the CSS file.
 * @param varName - CSS custom property name (e.g. "--density").
 * @param value   - New value (e.g. "1.25").
 */
export async function setRootVar(cssPath: string, varName: string, value: string): Promise<void> {
    if (!await fs.pathExists(cssPath)) {
        throw new Error(`CSS file not found: ${cssPath}`);
    }

    let content = await fs.readFile(cssPath, 'utf-8');

    // Match the :root block (non-greedy, stops at first closing brace after :root {)
    const rootBlockMatch = /(:root\s*\{)([\s\S]*?)(\})/m.exec(content);
    if (!rootBlockMatch) {
        throw new Error(`Could not find :root { } block in ${cssPath}`);
    }

    const [fullMatch, openBrace, inner, closeBrace] = rootBlockMatch;
    const updated = replaceVarInBlock(inner, varName, value);

    if (updated !== null) {
        content = content.replace(fullMatch, `${openBrace}${updated}${closeBrace}`);
    } else {
        // Append before :root closing brace
        content = content.replace(
            fullMatch,
            `${openBrace}${inner}    ${varName}: ${value};\n${closeBrace}`,
        );
    }

    await fs.writeFile(cssPath, content, 'utf-8');
}

/**
 * Set a CSS custom property in a named CSS block (e.g. ".dark { }").
 * If the property exists, updates it. If not found, appends it.
 *
 * @param cssPath   - Absolute path to the CSS file.
 * @param selector  - CSS selector for the block (e.g. ".dark").
 * @param varName   - CSS custom property name.
 * @param value     - New value.
 */
export async function setBlockVar(
    cssPath: string,
    selector: string,
    varName: string,
    value: string,
): Promise<void> {
    if (!await fs.pathExists(cssPath)) {
        throw new Error(`CSS file not found: ${cssPath}`);
    }

    let content = await fs.readFile(cssPath, 'utf-8');

    const escapedSelector = escapeRegex(selector);
    const blockPattern = new RegExp(`(${escapedSelector}\\s*\\{)([\\s\\S]*?)(\\})`, 'm');
    const blockMatch = blockPattern.exec(content);
    if (!blockMatch) {
        throw new Error(`Could not find ${selector} { } block in ${cssPath}`);
    }

    const [fullMatch, openBrace, inner, closeBrace] = blockMatch;
    const updated = replaceVarInBlock(inner, varName, value);

    if (updated !== null) {
        content = content.replace(fullMatch, `${openBrace}${updated}${closeBrace}`);
    } else {
        content = content.replace(
            fullMatch,
            `${openBrace}${inner}    ${varName}: ${value};\n${closeBrace}`,
        );
    }

    await fs.writeFile(cssPath, content, 'utf-8');
}
