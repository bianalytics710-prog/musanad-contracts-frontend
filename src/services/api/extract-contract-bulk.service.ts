/**
 * Musanad — AI bulk-extract stub client (M1c — S8).
 *
 * POST /api/v1/ai/extract-contract-bulk — controller-only stub on the BE.
 * Returns a deterministic mock (confidence keyed off extractedText.length).
 * M4 will replace the controller body without changing this DTO (AC-S8-07).
 *
 * Sensitive: extractedText is `ai_prompt_payload` per project.config.json
 * sensitiveFields. The BE pino-redacts; on the client side we MUST NOT
 * console.log the request body (T13). The api-client also never logs body.
 *
 * F-FE-001 — uses apiClient (NOT raw fetch) so JWT + X-Request-ID + 401
 * silent refresh fire on the request.
 */

import { apiClient } from "@/lib/api-client";
import type {
  ExtractContractBulkRequest,
  ExtractContractBulkResponse,
} from "@/types/entities/import-batch.types";

const PATH = "/api/v1/ai/extract-contract-bulk";

export const extractContractBulkService = {
  extract: async (
    payload: ExtractContractBulkRequest,
  ): Promise<ExtractContractBulkResponse> => {
    const { data } = await apiClient.post<ExtractContractBulkResponse>(
      PATH,
      payload,
    );
    return data;
  },
};

export default extractContractBulkService;
