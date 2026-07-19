"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import equal from "fast-deep-equal";
import {
  ArrowUpIcon,
  BotIcon,
  BrainIcon,
  EyeIcon,
  WrenchIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  type ChangeEvent,
  type Dispatch,
  memo,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import { DEFAULT_AGENT_ID } from "@/lib/acp/agents";
import {
  type AgentCapabilities,
  agentCapabilities,
  type ChatAgent,
  chatAgents,
} from "@/lib/agent-picker";
import { getChatHistoryPaginationKey } from "@/lib/chat-history";
import { useLocale } from "@/lib/i18n/locale-context";
import type { Attachment, ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "../ai-elements/prompt-input";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { PaperclipIcon, StopIcon } from "./icons";
import { PreviewAttachment } from "./preview-attachment";
import {
  type SlashCommand,
  SlashCommandMenu,
  slashCommands,
} from "./slash-commands";
import { SuggestedActions } from "./suggested-actions";
import type { VisibilityType } from "./visibility-selector";

function setCookie(name: string, value: string) {
  const maxAge = 60 * 60 * 24 * 365;
  // biome-ignore lint/suspicious/noDocumentCookie: needed for client-side cookie setting
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}`;
}

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  sendMessage,
  className,
  selectedVisibilityType,
  selectedAgentId,
  onAgentChange,
  editingMessage,
  onCancelEdit,
  isLoading,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: () => void;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  messages: UIMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage:
    | UseChatHelpers<ChatMessage>["sendMessage"]
    | (() => Promise<void>);
  className?: string;
  selectedVisibilityType: VisibilityType;
  selectedAgentId: string;
  onAgentChange?: (agentId: string) => void;
  editingMessage?: ChatMessage | null;
  onCancelEdit?: () => void;
  isLoading?: boolean;
}) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { setTheme, resolvedTheme } = useTheme();
  const { dict } = useLocale();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const hasAutoFocused = useRef(false);
  useEffect(() => {
    if (!hasAutoFocused.current && width) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
        hasAutoFocused.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [width]);

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    "input",
    ""
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      const finalValue = domValue || localStorageInput || "";
      setInput(finalValue);
    }
  }, [localStorageInput, setInput]);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);

  const handleInput = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const val = event.target.value;
      setInput(val);

      if (val.startsWith("/") && !val.includes(" ")) {
        setSlashOpen(true);
        setSlashQuery(val.slice(1));
        setSlashIndex(0);
      } else {
        setSlashOpen(false);
      }
    },
    [setInput]
  );

  const handleSlashSelect = useCallback(
    (cmd: SlashCommand) => {
      setSlashOpen(false);
      setInput("");
      switch (cmd.action) {
        case "new":
          router.push("/");
          break;
        case "clear":
          setMessages(() => []);
          break;
        case "rename":
          toast(dict.slash.renameHint);
          break;
        case "agent": {
          const agentBtn = document.querySelector<HTMLButtonElement>(
            "[data-testid='agent-selector']"
          );
          agentBtn?.click();
          break;
        }
        case "theme": {
          const order = ["light", "dark", "asel"] as const;
          const current = (resolvedTheme ?? "light") as string;
          const idx = order.indexOf(current as (typeof order)[number]);
          setTheme(order[((idx === -1 ? 0 : idx) + 1) % order.length]);
          break;
        }
        case "delete":
          toast(dict.slash.deletePrompt, {
            action: {
              label: dict.slash.deleteAction,
              onClick: () => {
                // The URL carries the composite <agentId>:<sessionId> once
                // the session exists (the chatId prop stays the client UUID
                // while the chat is live). No colon ⇒ the chat never reached
                // the agent, so there is no server-side session to delete.
                const match = window.location.pathname.match(/\/chat\/([^/]+)/);
                const urlChatId = match ? decodeURIComponent(match[1]) : null;
                router.push("/");
                if (!urlChatId?.includes(":")) {
                  toast.success(dict.sidebar.chatDeleted);
                  return;
                }
                toast.promise(
                  fetch(`/api/chat?id=${encodeURIComponent(urlChatId)}`, {
                    method: "DELETE",
                  }).then((response) => {
                    if (!response.ok) {
                      throw new Error(dict.sidebar.deleteChatFailed);
                    }
                    mutate(
                      unstable_serialize(
                        getChatHistoryPaginationKey(selectedAgentId)
                      )
                    );
                  }),
                  {
                    error: dict.sidebar.deleteChatFailed,
                    loading: dict.sidebar.deletingChat,
                    success: dict.sidebar.chatDeleted,
                  }
                );
              },
            },
          });
          break;
        case "purge":
          toast(dict.slash.deleteAllPrompt, {
            action: {
              label: dict.slash.deleteAllAction,
              onClick: () => {
                router.push("/");
                toast.promise(
                  fetch(
                    `/api/history?agent=${encodeURIComponent(selectedAgentId)}`,
                    { method: "DELETE" }
                  ).then((response) => {
                    if (!response.ok) {
                      throw new Error(dict.sidebar.deleteAllChatsFailed);
                    }
                    mutate(
                      unstable_serialize(
                        getChatHistoryPaginationKey(selectedAgentId)
                      ),
                      [],
                      { revalidate: false }
                    );
                  }),
                  {
                    error: dict.sidebar.deleteAllChatsFailed,
                    loading: dict.sidebar.deletingAllChats,
                    success: dict.sidebar.allChatsDeleted,
                  }
                );
              },
            },
          });
          break;
        default:
          break;
      }
    },
    [
      dict,
      mutate,
      resolvedTheme,
      router,
      selectedAgentId,
      setInput,
      setMessages,
      setTheme,
    ]
  );

  const submitForm = useCallback(() => {
    // Only move off "/" on the first send. Re-pushing /chat/<chatId> on
    // later sends would clobber the composite <agentId>:<sessionId> URL the
    // server resolved for this chat and split the conversation into a new
    // ACP session.
    if (!window.location.pathname.includes("/chat/")) {
      window.history.pushState(
        {},
        "",
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/chat/${chatId}`
      );
    }

    sendMessage({
      parts: [
        ...attachments.map((attachment) => ({
          mediaType: attachment.contentType,
          name: attachment.name,
          type: "file" as const,
          url: attachment.url,
        })),
        {
          text: input,
          type: "text",
        },
      ],
      role: "user",
    });

    setAttachments([]);
    setLocalStorageInput("");
    setInput("");

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    setInput,
    attachments,
    sendMessage,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
  ]);

  const uploadFile = useCallback(
    (_file: File): Promise<Attachment | undefined> => {
      // TODO(ACP): upload attachments through the agent backend
      // (was: POST /api/files/upload → { url, pathname, contentType }).
      toast.error("Attachments are disabled");
      return Promise.resolve(undefined);
    },
    []
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch {
        toast.error("Failed to upload files");
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) {
        return;
      }

      const imageItems = Array.from(items).filter((item) =>
        item.type.startsWith("image/")
      );

      if (imageItems.length === 0) {
        return;
      }

      event.preventDefault();

      setUploadQueue((prev) => [...prev, "Pasted image"]);

      try {
        const uploadPromises = imageItems
          .map((item) => item.getAsFile())
          .filter((file): file is File => file !== null)
          .map((file) => uploadFile(file));

        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) =>
            attachment !== undefined &&
            attachment.url !== undefined &&
            attachment.contentType !== undefined
        );

        setAttachments((curr) => [
          ...curr,
          ...(successfullyUploadedAttachments as Attachment[]),
        ]);
      } catch {
        toast.error("Failed to upload pasted image(s)");
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.addEventListener("paste", handlePaste);
    return () => textarea.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const handleCancelEditMouseDown = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onCancelEdit?.();
    },
    [onCancelEdit]
  );

  const handleSlashClose = useCallback(() => {
    setSlashOpen(false);
  }, []);

  const handlePromptSubmit = useCallback(() => {
    if (input.startsWith("/")) {
      const query = input.slice(1).trim();
      const cmd = slashCommands.find((c) => c.name === query);
      if (cmd) {
        handleSlashSelect(cmd);
      }
      return;
    }
    if (!input.trim() && attachments.length === 0) {
      return;
    }
    if (status === "ready" || status === "error") {
      submitForm();
    } else {
      toast.error(dict.composer.waitForModel);
    }
  }, [attachments.length, dict, handleSlashSelect, input, status, submitForm]);

  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (slashOpen) {
        const filtered = slashCommands.filter((cmd) =>
          cmd.name.startsWith(slashQuery.toLowerCase())
        );
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSlashIndex((i) => Math.min(i + 1, filtered.length - 1));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSlashIndex((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          if (filtered[slashIndex]) {
            handleSlashSelect(filtered[slashIndex]);
          }
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setSlashOpen(false);
          return;
        }
      }
      if (e.key === "Escape" && editingMessage && onCancelEdit) {
        e.preventDefault();
        onCancelEdit();
      }
    },
    [
      editingMessage,
      handleSlashSelect,
      onCancelEdit,
      slashIndex,
      slashOpen,
      slashQuery,
    ]
  );

  return (
    <div className={cn("relative flex w-full flex-col gap-4", className)}>
      {editingMessage && onCancelEdit ? (
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span>{dict.composer.editingMessage}</span>
          <button
            className="rounded px-1.5 py-0.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
            onMouseDown={handleCancelEditMouseDown}
            type="button"
          >
            {dict.composer.cancel}
          </button>
        </div>
      ) : null}

      {!editingMessage &&
        !isLoading &&
        messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 && (
          <SuggestedActions
            chatId={chatId}
            selectedAgentId={selectedAgentId}
            selectedVisibilityType={selectedVisibilityType}
            sendMessage={sendMessage}
          />
        )}

      <input
        className="pointer-events-none fixed -top-4 -left-4 size-0.5 opacity-0"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />

      <div className="relative">
        {slashOpen ? (
          <SlashCommandMenu
            onClose={handleSlashClose}
            onSelect={handleSlashSelect}
            query={slashQuery}
            selectedIndex={slashIndex}
          />
        ) : null}
      </div>

      <PromptInput
        className="[&>div]:rounded-2xl [&>div]:border [&>div]:border-border/60 [&>div]:bg-card [&>div]:shadow-[var(--shadow-composer)] [&>div]:transition-[border-color,box-shadow] [&>div]:duration-300 [&>div]:focus-within:border-primary/50 [&>div]:focus-within:shadow-[var(--shadow-composer-focus)]"
        onSubmit={handlePromptSubmit}
      >
        {(attachments.length > 0 || uploadQueue.length > 0) && (
          <div
            className="flex w-full self-start flex-row gap-2 overflow-x-auto px-3 pt-3 no-scrollbar"
            data-testid="attachments-preview"
          >
            {attachments.map((attachment) => (
              <AttachmentPreviewItem
                attachment={attachment}
                fileInputRef={fileInputRef}
                key={attachment.url}
                setAttachments={setAttachments}
              />
            ))}

            {uploadQueue.map((filename) => (
              <PreviewAttachment
                attachment={{
                  contentType: "",
                  name: filename,
                  url: "",
                }}
                isUploading={true}
                key={filename}
              />
            ))}
          </div>
        )}
        <PromptInputTextarea
          className="min-h-24 text-[14px] leading-relaxed px-4 pt-3.5 pb-1.5 placeholder:text-muted-foreground/55"
          data-testid="multimodal-input"
          onChange={handleInput}
          onKeyDown={handleTextareaKeyDown}
          placeholder={
            editingMessage
              ? dict.composer.editPlaceholder
              : dict.composer.placeholder
          }
          ref={textareaRef}
          value={input}
        />
        <PromptInputFooter className="px-3 pb-3">
          <PromptInputTools>
            <AttachmentsButton
              fileInputRef={fileInputRef}
              selectedAgentId={selectedAgentId}
              status={status}
            />
            <AgentSelectorCompact
              onAgentChange={onAgentChange}
              selectedAgentId={selectedAgentId}
            />
          </PromptInputTools>

          {status === "submitted" ? (
            <StopButton setMessages={setMessages} stop={stop} />
          ) : (
            <PromptInputSubmit
              className={cn(
                "h-7 w-7 rounded-xl transition-all duration-200",
                input.trim()
                  ? "bg-primary text-primary-foreground hover:opacity-85 active:scale-95"
                  : "bg-muted text-muted-foreground/25 cursor-not-allowed"
              )}
              data-testid="send-button"
              disabled={!input.trim() || uploadQueue.length > 0}
              status={status}
              variant="secondary"
            >
              <ArrowUpIcon className="size-4" />
            </PromptInputSubmit>
          )}
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) {
      return false;
    }
    if (prevProps.status !== nextProps.status) {
      return false;
    }
    if (!equal(prevProps.attachments, nextProps.attachments)) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }
    if (prevProps.selectedAgentId !== nextProps.selectedAgentId) {
      return false;
    }
    if (prevProps.editingMessage !== nextProps.editingMessage) {
      return false;
    }
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.messages.length !== nextProps.messages.length) {
      return false;
    }

    return true;
  }
);

function PureAttachmentPreviewItem({
  attachment,
  fileInputRef,
  setAttachments,
}: {
  attachment: Attachment;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
}) {
  const handleRemove = useCallback(() => {
    setAttachments((currentAttachments) =>
      currentAttachments.filter((a) => a.url !== attachment.url)
    );
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [attachment.url, fileInputRef, setAttachments]);

  return <PreviewAttachment attachment={attachment} onRemove={handleRemove} />;
}

const AttachmentPreviewItem = memo(PureAttachmentPreviewItem);

function PureAttachmentsButton({
  fileInputRef,
  status,
  selectedAgentId,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>["status"];
  selectedAgentId: string;
}) {
  // TODO(ACP): capabilities should come from the connected agent
  // (was: GET /api/models).
  const hasVision = agentCapabilities[selectedAgentId]?.vision ?? false;
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      fileInputRef.current?.click();
    },
    [fileInputRef]
  );

  return (
    <Button
      className={cn(
        "h-7 w-7 rounded-lg border border-border/40 p-1 transition-colors",
        hasVision
          ? "text-foreground hover:border-border hover:text-foreground"
          : "text-muted-foreground/30 cursor-not-allowed"
      )}
      data-testid="attachments-button"
      disabled={status !== "ready" || !hasVision}
      onClick={handleClick}
      variant="ghost"
    >
      <PaperclipIcon size={14} style={{ height: 14, width: 14 }} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function AgentSelectorOption({
  agent,
  capabilities,
  onAgentChange,
  selectedAgentId,
  setOpen,
}: {
  agent: ChatAgent;
  capabilities: Record<string, AgentCapabilities>;
  onAgentChange?: (agentId: string) => void;
  selectedAgentId: string;
  setOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const { dict } = useLocale();
  // Each registry agent brings its own icon; fall back to a neutral bot.
  const AgentIcon = agent.icon ?? BotIcon;
  const withTooltip = (icon: ReactNode, label: string) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{icon}</span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
  const handleSelect = useCallback(() => {
    onAgentChange?.(agent.id);
    setCookie("chat-agent", agent.id);
    setOpen(false);
    setTimeout(() => {
      document
        .querySelector<HTMLTextAreaElement>("[data-testid='multimodal-input']")
        ?.focus();
    }, 50);
  }, [agent.id, onAgentChange, setOpen]);

  return (
    <ModelSelectorItem
      className={cn(
        "flex w-full transition-colors data-[selected=true]:bg-muted data-[selected=true]:text-foreground",
        agent.id === selectedAgentId &&
          "border-b border-dashed border-foreground/50"
      )}
      // cmdk filters on `value` (the agent id); make display names findable.
      keywords={[agent.name]}
      onSelect={handleSelect}
      value={agent.id}
    >
      <AgentIcon className="size-4" />
      <ModelSelectorName>{agent.name}</ModelSelectorName>
      <div className="ml-auto flex items-center gap-2 text-foreground/70">
        {capabilities[agent.id]?.tools
          ? withTooltip(
              <WrenchIcon className="size-3.5" />,
              "Supports tool use"
            )
          : null}
        {capabilities[agent.id]?.vision
          ? withTooltip(
              <EyeIcon className="size-3.5" />,
              dict.agentPicker.supportsVision
            )
          : null}
        {capabilities[agent.id]?.reasoning
          ? withTooltip(
              <BrainIcon className="size-3.5" />,
              "Supports reasoning"
            )
          : null}
      </div>
    </ModelSelectorItem>
  );
}

function PureAgentSelectorCompact({
  selectedAgentId,
  onAgentChange,
}: {
  selectedAgentId: string;
  onAgentChange?: (agentId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { dict } = useLocale();
  // TODO(ACP): agent list and capabilities should come from the connected
  // agent (was: GET /api/models).
  const selectedAgent =
    chatAgents.find((a: ChatAgent) => a.id === selectedAgentId) ??
    chatAgents.find((a: ChatAgent) => a.id === DEFAULT_AGENT_ID) ??
    chatAgents[0];
  const SelectedIcon = selectedAgent.icon ?? BotIcon;

  return (
    <ModelSelector onOpenChange={setOpen} open={open}>
      <ModelSelectorTrigger asChild>
        <Button
          className="h-7 max-w-[200px] justify-between gap-1.5 rounded-lg px-2 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          data-testid="agent-selector"
          variant="ghost"
        >
          <SelectedIcon className="size-4" />
          <ModelSelectorName>{selectedAgent.name}</ModelSelectorName>
        </Button>
      </ModelSelectorTrigger>
      <ModelSelectorContent commandDefaultValue={selectedAgent.id}>
        <ModelSelectorInput placeholder={dict.agentPicker.searchPlaceholder} />
        <ModelSelectorList>
          <ModelSelectorGroup heading={dict.agentPicker.groupHeading}>
            {chatAgents.map((agent) => (
              <AgentSelectorOption
                agent={agent}
                capabilities={agentCapabilities}
                key={agent.id}
                onAgentChange={onAgentChange}
                selectedAgentId={selectedAgent.id}
                setOpen={setOpen}
              />
            ))}
          </ModelSelectorGroup>
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  );
}

const AgentSelectorCompact = memo(PureAgentSelectorCompact);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
}) {
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      stop();
      setMessages((messages) => messages);
    },
    [setMessages, stop]
  );

  return (
    <Button
      className="h-7 w-7 rounded-xl bg-foreground p-1 text-background transition-all duration-200 hover:opacity-85 active:scale-95 disabled:bg-muted disabled:text-muted-foreground/25 disabled:cursor-not-allowed"
      data-testid="stop-button"
      onClick={handleClick}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);
