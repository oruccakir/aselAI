import type { Chat } from "@/lib/types";

export type ChatHistory = {
  chats: Chat[];
  hasMore: boolean;
  nextCursor?: string | null;
};

/**
 * Per-agent SWR-infinite key factory. ACP paginates session/list by an
 * opaque cursor carried on each page as `nextCursor`. All invalidation
 * sites use `unstable_serialize(getChatHistoryPaginationKey(agentId))`,
 * which serializes the first-page key — a deterministic string per agent —
 * so separate closures still hit the same cache entry.
 */
export function getChatHistoryPaginationKey(agentId: string) {
  return (_pageIndex: number, previousPageData: ChatHistory | null) => {
    const base = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history?agent=${encodeURIComponent(agentId)}`;
    if (!previousPageData) {
      return base;
    }
    if (!(previousPageData.hasMore && previousPageData.nextCursor)) {
      return null;
    }
    return `${base}&cursor=${encodeURIComponent(previousPageData.nextCursor)}`;
  };
}
