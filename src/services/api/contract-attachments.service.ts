/**
 * Contract attachments API client.
 *
 * BE-mediated upload model: file bytes flow through the BE which writes
 * them to Supabase Storage using its service-role key. The FE never
 * touches Supabase credentials.
 */
import { apiClient, unwrap } from "@/lib/api-client";

export interface ContractAttachment {
  id: number;
  contractId: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  description: string | null;
  storageBucket: string;
  storagePath: string;
  uploadedBy: { id: number; firstName: string; lastName: string };
  createdAt: string;
}

export interface SignedDownloadResponse {
  id: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  expiresIn: number;
}

export const contractAttachmentsService = {
  list: async (contractId: number): Promise<ContractAttachment[]> => {
    const { data } = await apiClient.get(`/api/v1/contracts/${contractId}/attachments`);
    return unwrap<ContractAttachment[]>(data);
  },

  upload: async (
    contractId: number,
    file: File,
    description?: string,
  ): Promise<{ id: number; contractId: number; filename: string; sizeBytes: number; mimeType: string }> => {
    const form = new FormData();
    form.append("file", file);
    if (description && description.trim()) form.append("description", description.trim());
    const { data } = await apiClient.post(
      `/api/v1/contracts/${contractId}/attachments`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return unwrap(data);
  },

  getDownloadUrl: async (contractId: number, fileId: number): Promise<SignedDownloadResponse> => {
    const { data } = await apiClient.get(
      `/api/v1/contracts/${contractId}/attachments/${fileId}/url`,
    );
    return unwrap<SignedDownloadResponse>(data);
  },

  remove: async (contractId: number, fileId: number): Promise<void> => {
    await apiClient.delete(`/api/v1/contracts/${contractId}/attachments/${fileId}`);
  },
};
