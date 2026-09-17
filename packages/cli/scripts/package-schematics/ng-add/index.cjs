'use strict';

/**
 * `ng add @gilav21/shadcn-angular-<package>` — registers the package's compiled
 * stylesheet in angular.json, the only setup a package consumer needs.
 *
 * Shared verbatim by every compiled package (the stylesheet path is derived
 * from the package's own name), and written against the plain schematic
 * `Tree` / `context` contract so it needs no `@angular-devkit/*` dependency.
 */

const WORKSPACE_FILE = 'angular.json';

/** Builder targets whose `styles` option decides what CSS a project loads. */
const STYLED_TARGETS = ['build', 'test'];

/** @param {string} packageName */
function stylesheetFor(packageName) {
    return `${packageName}/styles.css`;
}

/** @param {unknown} entry */
function entryPath(entry) {
    if (typeof entry === 'string') return entry;
    if (entry && typeof entry === 'object' && 'input' in entry) return String(entry.input);
    return '';
}

/**
 * The projects to configure: the one named, or every application.
 * @param {Record<string, any>} projects
 * @param {string | undefined} requested
 */
function targetProjects(projects, requested) {
    if (requested) {
        if (!projects[requested]) throw new Error(`Project "${requested}" does not exist in ${WORKSPACE_FILE}.`);
        return [requested];
    }
    return Object.keys(projects).filter((name) => projects[name].projectType === 'application');
}

/**
 * Prepends the stylesheet to one options block, unless it is already there.
 * First in the list, so the app's own stylesheets load after it and win ties.
 *
 * @param {Record<string, any> | undefined} options a target's `options` or one configuration's
 * @param {string} stylesheet
 * @returns {boolean} whether anything changed
 */
function prependTo(options, stylesheet) {
    if (!options || !Array.isArray(options.styles)) return false;
    if (options.styles.some((entry) => entryPath(entry) === stylesheet)) return false;
    options.styles = [stylesheet, ...options.styles];
    return true;
}

/**
 * Registers the stylesheet on each project's build and test targets, and on
 * every configuration that declares its OWN `styles`.
 *
 * Angular does not merge a configuration's `styles` into the target's — it
 * replaces the list. So a `production` configuration that sets `styles` would
 * build without the package stylesheet, and the failure is silent: an unstyled
 * component in a production bundle, with no error anywhere.
 *
 * Idempotent, and a target with no `styles` at all gets the list created.
 *
 * @param {Record<string, any>} workspace parsed angular.json (mutated)
 * @param {string} packageName
 * @param {string} [project]
 * @returns {string[]} `<project>:<target>` / `<project>:<target>:<configuration>` labels that changed
 */
function addStylesheet(workspace, packageName, project) {
    const stylesheet = stylesheetFor(packageName);
    const projects = workspace.projects ?? {};
    const changed = [];

    for (const name of targetProjects(projects, project)) {
        const targets = projects[name].architect ?? projects[name].targets ?? {};
        for (const targetName of STYLED_TARGETS) {
            const target = targets[targetName];
            if (!target) continue;

            target.options ??= {};
            target.options.styles ??= [];
            if (prependTo(target.options, stylesheet)) changed.push(`${name}:${targetName}`);

            for (const [configName, config] of Object.entries(target.configurations ?? {})) {
                if (prependTo(config, stylesheet)) changed.push(`${name}:${targetName}:${configName}`);
            }
        }
    }
    return changed;
}

/**
 * Reads angular.json, or explains the one manual edit that replaces this
 * schematic.
 *
 * The Angular CLI tolerates comments in angular.json; `JSON.parse` does not.
 * Rather than re-implement JSON-with-comments — a parser with more edge cases
 * (markers inside strings, escapes) than this whole schematic — an unparsable
 * workspace fails with the exact edit to make by hand.
 *
 * @param {string} raw
 * @param {string} stylesheet
 */
function parseWorkspace(raw, stylesheet) {
    try {
        return JSON.parse(raw);
    } catch {
        throw new Error(
            `Could not read ${WORKSPACE_FILE} as JSON (comments are not supported here). ` +
            `Add "${stylesheet}" to the "styles" array of your app's build and test targets by hand — ` +
            'that is all this schematic does.',
        );
    }
}

/**
 * The schematic body over an injected tree/logger, so it is testable without
 * the Angular CLI.
 *
 * @param {{ exists(p: string): boolean, read(p: string): Buffer | null, overwrite(p: string, c: string): void }} tree
 * @param {{ info(m: string): void, warn(m: string): void }} logger
 * @param {string} packageName
 * @param {string} [project]
 */
function runNgAdd(tree, logger, packageName, project) {
    const stylesheet = stylesheetFor(packageName);
    if (!tree.exists(WORKSPACE_FILE)) {
        throw new Error(`No ${WORKSPACE_FILE} found. Add "${stylesheet}" to your app's styles manually.`);
    }

    const workspace = parseWorkspace(String(tree.read(WORKSPACE_FILE)), stylesheet);
    const changed = addStylesheet(workspace, packageName, project);
    if (changed.length === 0) {
        logger.info(`${stylesheet} is already registered — nothing to do.`);
        return;
    }

    tree.overwrite(WORKSPACE_FILE, `${JSON.stringify(workspace, null, 2)}\n`);
    logger.info(`Added ${stylesheet} to ${changed.join(', ')}.`);
}

/** Schematic factory referenced by collection.json. */
function ngAdd(options) {
    return (tree, context) => {
        // Resolved at run time from the installed package, so one file serves every package.
        const { name } = require('../../package.json');
        runNgAdd(tree, context.logger, name, options?.project);
        return tree;
    };
}

module.exports = { addStylesheet, runNgAdd, ngAdd };
