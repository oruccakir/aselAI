"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { usePathname } from "next/navigation";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { useDataStream } from "@/components/chat/data-stream-provider";
import { toast } from "@/components/chat/toast";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { DEFAULT_AGENT_ID } from "@/lib/acp/agents";
import { getChatHistoryPaginationKey } from "@/lib/chat-history";
import { ChatbotError } from "@/lib/errors";
import { useLocale } from "@/lib/i18n/locale-context";
import type { ChatMessage } from "@/lib/types";
import { fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";

type ActiveChatContextValue = {
  chatId: string;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  status: UseChatHelpers<ChatMessage>["status"];
  stop: UseChatHelpers<ChatMessage>["stop"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  visibilityType: VisibilityType;
  isReadonly: boolean;
  isLoading: boolean;
  currentAgentId: string;
  setCurrentAgentId: (id: string) => void;
  showCreditCardAlert: boolean;
  setShowCreditCardAlert: Dispatch<SetStateAction<boolean>>;
};

const ActiveChatContext = createContext<ActiveChatContextValue | null>(null);

function extractChatId(pathname: string): string | null {
  const match = pathname.match(/\/chat\/([^/]+)/);
  return match ? match[1] : null;
}

export function ActiveChatProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { dict } = useLocale();
  const { setDataStream, setWaitingStatus } = useDataStream();
  const { mutate } = useSWRConfig();

  const chatIdFromUrl = extractChatId(pathname);
  const newChatIdRef = useRef(generateUUID());
  const prevPathnameRef = useRef(pathname);

  // Once /api/chat creates the real ACP session, it streams back the
  // composite `<agentId>:<sessionId>` chat id. The transport reads this ref
  // at send time so the second message continues the SAME session instead
  // of creating a new one per send.
  const resolvedChatIdRef = useRef<string | null>(null);

  if (prevPathnameRef.current !== pathname) {
    if (!chatIdFromUrl) {
      newChatIdRef.current = generateUUID();
    }
    const isStillThisChat =
      chatIdFromUrl === resolvedChatIdRef.current ||
      chatIdFromUrl === newChatIdRef.current;
    if (!isStillThisChat) {
      // Navigated to a different chat — the resolved id belongs to the old one.
      resolvedChatIdRef.current = null;
    }
  }
  prevPathnameRef.current = pathname;

  // When the URL was just rewritten to the composite id THIS chat resolved,
  // it is still the same live conversation: keep the stable client-side id
  // so useChat does not remount (and drop the stream) mid-turn. usePathname
  // tracks native history.replaceState in Next 16, so without this guard
  // the id change would reset the chat right after the first send.
  const isLiveResolvedChat =
    chatIdFromUrl !== null && chatIdFromUrl === resolvedChatIdRef.current;
  const isNewChat = !chatIdFromUrl || isLiveResolvedChat;
  const chatId = isNewChat ? newChatIdRef.current : (chatIdFromUrl as string);

  const [currentAgentId, setCurrentAgentId] =
    useState<string>(DEFAULT_AGENT_ID);
  const currentAgentIdRef = useRef(currentAgentId);
  useEffect(() => {
    currentAgentIdRef.current = currentAgentId;
  }, [currentAgentId]);

  const [input, setInput] = useState("");
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);

  // The transport is memoized once; everything mutable it needs at send
  // time (selected agent, resolved chat id) is read through refs.
  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat`,
        fetch: fetchWithErrorHandlers,
        prepareSendMessagesRequest(request) {
          return {
            body: {
              agentId: currentAgentIdRef.current,
              id: resolvedChatIdRef.current ?? request.id,
              message: request.messages.at(-1),
              ...request.body,
            },
          };
        },
      }),
    []
  );

  // Load persisted messages only for cold-opened session chats (composite
  // ids contain a colon; bare UUIDs never had a session to load).
  const { data: chatData, isLoading } = useSWR(
    !isNewChat && chatId.includes(":")
      ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/messages?chatId=${encodeURIComponent(chatId)}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const initialMessages: ChatMessage[] = isNewChat
    ? []
    : (chatData?.messages ?? []);
  const visibility: VisibilityType = isNewChat
    ? "private"
    : (chatData?.visibility ?? "private");

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    addToolApprovalResponse,
  } = useChat<ChatMessage>({
    generateId: generateUUID,
    id: chatId,
    messages: initialMessages,
    onData: (dataPart) => {
      if (dataPart.type === "data-session-id") {
        // First send of a new chat: the server created the ACP session and
        // sent back the composite chat id. Remember it for every subsequent
        // send and rewrite the URL (replaceState does not remount the
        // provider — proven by the ?query= effect below).
        resolvedChatIdRef.current = dataPart.data;
        window.history.replaceState(
          {},
          "",
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/chat/${dataPart.data}`
        );
        return;
      }
      if (dataPart.type === "data-waiting-status") {
        setWaitingStatus(dataPart.data);
        return;
      }
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
    },
    onError: (error) => {
      if (error instanceof ChatbotError) {
        toast({ description: error.message, type: "error" });
      } else {
        toast({
          description: error.message || dict.toasts.genericError,
          type: "error",
        });
      }
    },
    onFinish: () => {
      mutate(
        unstable_serialize(
          getChatHistoryPaginationKey(currentAgentIdRef.current)
        )
      );
    },
    // No sendAutomaticallyWhen: permission answers travel out-of-band via
    // POST /api/acp/permission while the original stream stays open, so a
    // second concurrent stream on the same chat must never be started.
    transport,
  });

  useEffect(() => {
    if (status === "submitted" || status === "ready" || status === "error") {
      setWaitingStatus(undefined);
    }
  }, [status, setWaitingStatus]);

  const loadedChatIds = useRef(new Set<string>());

  if (isNewChat && !loadedChatIds.current.has(newChatIdRef.current)) {
    loadedChatIds.current.add(newChatIdRef.current);
  }

  useEffect(() => {
    if (loadedChatIds.current.has(chatId)) {
      return;
    }
    if (chatData?.messages) {
      loadedChatIds.current.add(chatId);
      setMessages(chatData.messages);
    }
  }, [chatId, chatData?.messages, setMessages]);

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      if (isNewChat) {
        setMessages([]);
      }
    }
  }, [chatId, isNewChat, setMessages]);

  useEffect(() => {
    if (!isNewChat) {
      const cookieAgent = document.cookie
        .split("; ")
        .find((row) => row.startsWith("chat-agent="))
        ?.split("=")[1];
      if (cookieAgent) {
        setCurrentAgentId(decodeURIComponent(cookieAgent));
      }
    }
  }, [isNewChat]);

  const hasAppendedQueryRef = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get("query");
    if (query && !hasAppendedQueryRef.current) {
      hasAppendedQueryRef.current = true;
      window.history.replaceState(
        {},
        "",
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/chat/${chatId}`
      );
      sendMessage({
        parts: [{ text: query, type: "text" }],
        role: "user" as const,
      });
    }
  }, [sendMessage, chatId]);

  const isReadonly = isNewChat ? false : (chatData?.isReadonly ?? false);

  const value = useMemo<ActiveChatContextValue>(
    () => ({
      addToolApprovalResponse,
      chatId,
      currentAgentId,
      input,
      isLoading: !isNewChat && isLoading,
      isReadonly,
      messages,
      regenerate,
      sendMessage,
      setCurrentAgentId,
      setInput,
      setMessages,
      setShowCreditCardAlert,
      showCreditCardAlert,
      status,
      stop,
      visibilityType: visibility,
    }),
    [
      chatId,
      messages,
      setMessages,
      sendMessage,
      status,
      stop,
      regenerate,
      addToolApprovalResponse,
      input,
      visibility,
      isReadonly,
      isNewChat,
      isLoading,
      currentAgentId,
      showCreditCardAlert,
    ]
  );

  return (
    <ActiveChatContext.Provider value={value}>
      {children}
    </ActiveChatContext.Provider>
  );
}

export function useActiveChat() {
  const context = useContext(ActiveChatContext);
  if (!context) {
    throw new Error("useActiveChat must be used within ActiveChatProvider");
  }
  return context;
}
