/**
 * Test utilities for plugin testing
 */

export const createMockReporter = () => ({
  report: jest.fn(),
  getReports: jest.fn(() => []),
});

export const createMockContext = (path = "test.field") => ({
  path,
  reporter: createMockReporter(),
  allValues: {},
});
