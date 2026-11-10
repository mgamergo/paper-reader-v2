import { test as base, expect } from "@playwright/test";
export interface Diagnostics {
  errors: string[];
  allowHttp: (pattern: RegExp, status: number) => void;
}
export const test = base.extend<{ diagnostics: Diagnostics }>({
  diagnostics: [
    async ({ page }, use) => {
      const errors: string[] = [];
      const allowed: { pattern: RegExp; status: number }[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") {
          const expectedResourceError = message
            .text()
            .match(
              /^Failed to load resource: the server responded with a status of (\d+) \([^)]*\)$/,
            );
          if (
            expectedResourceError &&
            allowed.some(
              (item) =>
                item.status === Number(expectedResourceError[1]) &&
                item.pattern.test(message.location().url),
            )
          )
            return;
          errors.push(`console: ${message.text()}`);
        }
      });
      page.on("pageerror", (error) =>
        errors.push(`pageerror: ${error.message}`),
      );
      page.on("requestfailed", (request) =>
        errors.push(
          `requestfailed: ${request.url()} ${request.failure()?.errorText}`,
        ),
      );
      page.on("response", (response) => {
        if (
          response.status() >= 400 &&
          !allowed.some(
            (item) =>
              item.status === response.status() &&
              item.pattern.test(response.url()),
          )
        )
          errors.push(`HTTP ${response.status()}: ${response.url()}`);
      });
      await use({
        errors,
        allowHttp: (pattern, status) => allowed.push({ pattern, status }),
      });
      expect(
        errors,
        "Unexpected browser console, page, network, or HTTP errors",
      ).toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };
