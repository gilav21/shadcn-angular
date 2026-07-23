// Real jest consumer config used to validate the vitest-compat shim.
// jest-preset-angular provides the Angular/zone TestBed environment a typical
// consumer runs; the specs shipped by `add --include-tests --testRunner jest`
// import `vi` from the installed shim, which this config resolves via the @/*
// alias mapping (same as any consumer whose jest maps their TS paths).
const { createCjsPreset } = require('jest-preset-angular/presets');

module.exports = {
    ...createCjsPreset(),
    rootDir: __dirname,
    setupFilesAfterEnv: ['<rootDir>/setup-jest.cjs'],
    testMatch: ['<rootDir>/src/**/*.spec.ts'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    transform: {
        '^.+\\.(ts|js|mjs|html|svg)$': [
            'jest-preset-angular',
            { tsconfig: '<rootDir>/tsconfig.spec.json', stringifyContentPathRegex: '\\.(html|svg)$' },
        ],
    },
};
