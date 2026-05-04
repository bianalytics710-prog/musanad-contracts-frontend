/**
 * Musanad — Browser-side text extraction (M1c — AC-S5-02).
 *
 * Per AC-S5-02 the BE never receives raw PDF/DOCX bytes — extraction runs
 * in the browser via mammoth (DOCX) and pdfjs-dist (PDF). The downstream
 * AI stub (POST /api/v1/ai/extract-contract-bulk) takes the resulting
 * text + filename + size only.
 *
 * Why dynamic imports: pdfjs ships a heavy worker bundle. Dynamic imports
 * keep the bulk-import route's initial chunk lean — these libraries only
 * load when the user actually drops a file.
 *
 * Output text is NOT logged anywhere — contract bodies are SENSITIVE
 * (T13). The router upstream of this helper handles redaction.
 */

export interface ExtractedText {
  text: string;
  pages: number;
}

/** Anything mammoth/pdfjs throws is normalised to this. */
export class TextExtractionError extends Error {
  readonly kind: "unsupported" | "parse_error" | "empty";
  constructor(kind: "unsupported" | "parse_error" | "empty", message: string) {
    super(message);
    this.name = "TextExtractionError";
    this.kind = kind;
  }
}

export async function extractTextFromFile(file: File): Promise<ExtractedText> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return extractFromPdf(file);
  }
  if (
    name.endsWith(".docx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractFromDocx(file);
  }
  throw new TextExtractionError("unsupported", "Unsupported file type");
}

async function extractFromPdf(file: File): Promise<ExtractedText> {
  // pdfjs-dist legacy build is the most browser-portable variant. Loaded
  // lazily so the route's initial chunk stays small.
  let pdfjsModule: unknown;
  let workerModule: { default: string };
  try {
    pdfjsModule = await import("pdfjs-dist/legacy/build/pdf.mjs");
    workerModule = (await import(
      "pdfjs-dist/legacy/build/pdf.worker.mjs?url"
    )) as { default: string };
  } catch (err) {
    throw new TextExtractionError(
      "parse_error",
      err instanceof Error ? err.message : "Failed to load PDF parser",
    );
  }

  // pdfjs's runtime API is dynamically typed — narrow only the calls we use.
  const pdfjs = pdfjsModule as {
    GlobalWorkerOptions: { workerSrc: string };
    getDocument: (config: { data: ArrayBuffer }) => {
      promise: Promise<{
        numPages: number;
        getPage: (n: number) => Promise<{
          getTextContent: () => Promise<{
            items: Array<{ str?: string }>;
          }>;
        }>;
      }>;
    };
  };

  pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;

  const buffer = await file.arrayBuffer();
  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
  try {
    doc = await pdfjs.getDocument({ data: buffer }).promise;
  } catch (err) {
    throw new TextExtractionError(
      "parse_error",
      err instanceof Error ? err.message : "Failed to parse PDF",
    );
  }

  const pages = doc.numPages;
  let out = "";
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item) =>
      typeof item.str === "string" ? item.str : "",
    );
    out += strings.join(" ") + "\n\n";
  }
  const text = out.trim();
  if (text.length === 0) {
    throw new TextExtractionError(
      "empty",
      "PDF appears to contain no extractable text",
    );
  }
  return { text, pages };
}

async function extractFromDocx(file: File): Promise<ExtractedText> {
  // mammoth's browser bundle exports `extractRawText`; types file ships
  // with the package but the browser path is untyped.
  let mammothModule: unknown;
  try {
    mammothModule = await import("mammoth/mammoth.browser");
  } catch (err) {
    throw new TextExtractionError(
      "parse_error",
      err instanceof Error ? err.message : "Failed to load DOCX parser",
    );
  }
  const mammoth = mammothModule as {
    extractRawText: (config: {
      arrayBuffer: ArrayBuffer;
    }) => Promise<{ value?: string }>;
  };
  const buffer = await file.arrayBuffer();
  let result: { value?: string };
  try {
    result = await mammoth.extractRawText({ arrayBuffer: buffer });
  } catch (err) {
    throw new TextExtractionError(
      "parse_error",
      err instanceof Error ? err.message : "Failed to parse DOCX",
    );
  }
  const text = (result.value ?? "").trim();
  if (text.length === 0) {
    throw new TextExtractionError(
      "empty",
      "DOCX appears to contain no extractable text",
    );
  }
  // Approximate a "page" count for UI display only; mammoth does not expose
  // page boundaries (raw text only). Roughly 3000 chars per page.
  const pages = Math.max(1, Math.ceil(text.length / 3000));
  return { text, pages };
}
