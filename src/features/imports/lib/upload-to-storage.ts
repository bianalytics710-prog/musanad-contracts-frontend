/**
 * Musanad — Supabase Storage upload helper (M1c).
 *
 * Per HQ1 (developer-ratified at HITL Gate 2): bulk-import PDF/DOCX files
 * upload directly from the browser to the existing Supabase 'contracts'
 * bucket via supabase-js. The backend takes only the resulting storage_path;
 * raw file bytes never traverse our BE (faster + smaller request envelopes).
 *
 * The Supabase URL + anon key are read from Vite env. When unset (e.g.
 * local dev without storage), the helper returns null and callers fall
 * back to filename-only mode (contract.import_filename captures the name).
 *
 * Security: anon key is by design public-facing — the bucket has RLS that
 * scopes writes to authenticated users. We do NOT use the service-role key
 * here (that's BE-only).
 */

const BUCKET = "contracts";

/** Cached client — instantiated lazily to keep the chunk lean. */
type SupabaseLike = {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: File,
        options?: { upsert?: boolean; cacheControl?: string },
      ) => Promise<{ data: { path: string } | null; error: Error | null }>;
    };
  };
} | null;

let cachedClient: SupabaseLike = null;

async function getStorageClient(): Promise<SupabaseLike> {
  if (cachedClient !== null) return cachedClient;
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
  const key =
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";
  if (!url || !key) return null;
  try {
    const mod = await import("@supabase/supabase-js");
    cachedClient = mod.createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as unknown as SupabaseLike;
    return cachedClient;
  } catch {
    // supabase-js absent or failed to load — fall back to filename-only.
    return null;
  }
}

/**
 * Upload a single file to Supabase storage. Returns the storage path on
 * success, null when storage is not configured, or throws on a real error.
 *
 * Path shape: `bulk-import/{batchId}/{epoch}-{sanitised filename}` —
 * collision-safe across concurrent batches and replays.
 */
export async function uploadToStorage(
  file: File,
  batchId: number,
): Promise<string | null> {
  const client = await getStorageClient();
  if (!client) return null;

  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
  const path = `bulk-import/${batchId}/${Date.now()}-${safeName}`;
  const { data, error } = await client.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    cacheControl: "3600",
  });
  if (error) throw error;
  return data?.path ?? null;
}
