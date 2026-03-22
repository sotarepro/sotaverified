/**
 * Test tools are only enabled in development or when ENABLE_TEST_TOOLS=true.
 * NEVER enable in production.
 */
export function isTestToolsEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.ENABLE_TEST_TOOLS === "true"
  );
}
