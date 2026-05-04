/**
 * Ambient declaration for mammoth's browser bundle.
 *
 * mammoth ships TypeScript types for the Node entry point but the browser
 * subpath (`mammoth/mammoth.browser`) has no .d.ts. We narrow the surface
 * to just the methods M1c uses (extractRawText) — the `unknown` shapes
 * are then refined at the call site in features/imports/lib/extract-text.ts.
 */
declare module "mammoth/mammoth.browser" {
  export function extractRawText(input: {
    arrayBuffer: ArrayBuffer;
  }): Promise<{ value?: string; messages?: unknown[] }>;
}
