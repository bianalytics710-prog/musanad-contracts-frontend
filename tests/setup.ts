import "@testing-library/jest-dom/vitest";

// jsdom does not implement matchMedia — required by ThemeProvider.
if (typeof window !== "undefined" && !window.matchMedia) {
  // Cast through unknown to avoid `any` while still satisfying the TS type.
  (window as unknown as { matchMedia: (query: string) => MediaQueryList }).matchMedia = (
    query: string,
  ): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// Provide a stable VITE_API_BASE_URL during unit tests.
if (!import.meta.env.VITE_API_BASE_URL) {
  (import.meta.env as Record<string, string>).VITE_API_BASE_URL = "http://localhost:4000";
}
if (!import.meta.env.VITE_DISPLAY_TIMEZONE) {
  (import.meta.env as Record<string, string>).VITE_DISPLAY_TIMEZONE = "Asia/Dubai";
}
