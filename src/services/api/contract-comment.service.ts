/**
 * Contract Comments service (R4 audit gap 8.2.1).
 *
 * 4 endpoints under /api/v1/contracts/:id/comments. Plain JSON, no
 * multipart. Reads pass through `unwrap<T>()` so consumers get the data
 * payload directly.
 */
import { apiClient, unwrap } from "@/lib/api-client";

export interface CommentUserRef {
  id: number;
  firstName: string;
  lastName: string;
}

export interface ContractCommentReply {
  id: number;
  parentId: number;
  body: string;
  mentionedUserIds: number[];
  createdAt: string;
  createdBy: CommentUserRef | null;
}

/** 687 — kind discriminator: 'general' free chat vs 'redline' pinned to doc. */
export type ContractCommentKind = "general" | "redline";

export interface ContractComment {
  id: number;
  contractId: number;
  body: string;
  commentKind: ContractCommentKind;
  // 687 — anchor (populated only for redline comments).
  anchorClauseId: string | null;
  anchorClauseHeading: string | null;
  anchorQuote: string | null;
  anchorSide: "en" | "ar" | null;
  anchorVersionNumber: number | null;
  mentionedUserIds: number[];
  resolvedAt: string | null;
  resolvedBy: number | null;
  resolvedByUser: CommentUserRef | null;
  createdAt: string;
  updatedAt: string;
  createdBy: CommentUserRef | null;
  replies: ContractCommentReply[];
}

export type ContractCommentFilter =
  | "all"
  | "unresolved"
  | "mine"
  | "mentions_me"
  | "redlines";

/** Payload for creating a comment. Anchor fields only sent for redlines. */
export interface CreateCommentPayload {
  body: string;
  parentId?: number | null;
  mentionedUserIds?: number[];
  commentKind?: ContractCommentKind;
  anchorClauseId?: string | null;
  anchorClauseHeading?: string | null;
  anchorQuote?: string | null;
  anchorSide?: "en" | "ar" | null;
  anchorVersionNumber?: number | null;
}

export const contractCommentService = {
  list: async (
    contractId: number,
    filter: ContractCommentFilter = "all",
  ): Promise<ContractComment[]> => {
    const { data } = await apiClient.get(
      `/api/v1/contracts/${contractId}/comments`,
      { params: { filter } },
    );
    return unwrap<ContractComment[]>(data);
  },

  create: async (
    contractId: number,
    payload: CreateCommentPayload,
  ): Promise<{ id: number }> => {
    const { data } = await apiClient.post(`/api/v1/contracts/${contractId}/comments`, payload);
    return unwrap<{ id: number }>(data);
  },

  resolve: async (
    contractId: number,
    commentId: number,
  ): Promise<{ id: number; resolved: boolean }> => {
    const { data } = await apiClient.post(
      `/api/v1/contracts/${contractId}/comments/${commentId}/resolve`,
    );
    return unwrap<{ id: number; resolved: boolean }>(data);
  },

  // 687 — re-open a thread the drafter marked done but didn't satisfy.
  reopen: async (
    contractId: number,
    commentId: number,
  ): Promise<{ id: number; resolved: boolean }> => {
    const { data } = await apiClient.post(
      `/api/v1/contracts/${contractId}/comments/${commentId}/reopen`,
    );
    return unwrap<{ id: number; resolved: boolean }>(data);
  },

  remove: async (
    contractId: number,
    commentId: number,
  ): Promise<{ id: number; deleted: boolean }> => {
    const { data } = await apiClient.delete(
      `/api/v1/contracts/${contractId}/comments/${commentId}`,
    );
    return unwrap<{ id: number; deleted: boolean }>(data);
  },
};
