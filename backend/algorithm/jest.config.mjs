/*
jest.config.mjs
Configures the backend algorithm and event-management test suite.
The active settings here focus on clear mocks and strict coverage for event_management.
*/

/** @type {import('jest').Config} */
const config = {
  // Reset mock call history between tests so the assertions stay isolated.
  clearMocks: true,

  // Collect coverage for the backend test run.
  collectCoverage: true,

  // Limit coverage enforcement to the event_management MVC files.
  collectCoverageFrom: ["event_management/**/*.js", "!event_management/**/*.test.js"],

  // Write the coverage output into the local coverage folder.
  coverageDirectory: "coverage",

  // Use V8 coverage so the reports match the runtime.
  coverageProvider: "v8",

  // Keep the event_management module fully covered while it stays small.
  coverageThreshold: {
    "event_management/": {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },

};

export default config;
