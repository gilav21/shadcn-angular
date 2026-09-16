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
 * Prepends the stylesheet to the `styles` of each project's build and test
 * targets. First, so the app's own stylesheets load after it and win ties.
 * Idempotent: a target that already lists it is left alone.
 *
 * @param {Record<string, any>} workspace parsed angular.json (mutated)
 * @param {string} packageName
 * @param {string} [project]
 * @returns {string[]} `<project>:<target>` labels that changed
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
            const styles = Array.isArray(target.options.styles) ? target.options.styles : [];
            if (styles.some((entry) => entryPath(entry) === stylesheet)) continue;
            target.options.styles = [stylesheet, ...styles];
            changed.push(`${name}:${targetName}`);
        }
    }
    return changed;
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

    const workspace = JSON.parse(String(tree.read(WORKSPACE_FILE)));
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
