module.exports = {
  clearMocks: true,
  testEnvironment: "node",
  testMatch: [
    "<rootDir>/tests/**/*.test.js",
    "<rootDir>/event_management/tests/**/*.test.js"
  ],
  transform: {
    "^.+\\.js$": "babel-jest"
  },
  collectCoverage: true,
  coverageProvider: "v8",
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "<rootDir>/calendar_event_normalizer.js",
    "<rootDir>/db/dbInterface.js",
    "<rootDir>/event_management/**/*.js",
    "!<rootDir>/event_management/tests/**/*.test.js"
  ]
};
