// Initializes the Angular TestBed environment for jest (zone-based), exactly as
// a jest-preset-angular consumer's setup file does. Runs after the test
// framework is installed (setupFilesAfterEnv), before each spec's TestBed use.
const { setupZoneTestEnv } = require('jest-preset-angular/setup-env/zone');

setupZoneTestEnv();
