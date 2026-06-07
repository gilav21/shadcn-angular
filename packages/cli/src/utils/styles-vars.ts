import fs from 'fs-extra';

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
