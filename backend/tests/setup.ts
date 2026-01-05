/**
 * Jest setup file for CleanCity backend tests
 */

// Increase timeout for property-based tests
jest.setTimeout(30000);

// Suppress console output during tests unless debugging
if (process.env.DEBUG !== 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    // Keep error for debugging
    error: console.error
  };
}
