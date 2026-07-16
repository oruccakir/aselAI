import type { ChatTransport, UIMessageChunk } from "ai";
import type { ChatMessage } from "@/lib/types";

/**
 * TODO(ACP): This is the single integration point for the future Agent
 * Context Protocol backend. Replace this stub with a real transport:
 * `sendMessages` must return a stream of UIMessageChunk events produced by
 * the agent, and `reconnectToStream` should resume an interrupted stream
 * (returning null when there is nothing to resume).
 *
 * The removed backend expected this request body shape per send:
 * `{ id, message | messages, selectedChatModel, selectedVisibilityType }`,
 * where the full `messages` array was sent only for tool-approval
 * continuations (any part in state "approval-responded"/"output-denied").
 */
export class StubChatTransport implements ChatTransport<ChatMessage> {
  sendMessages(): Promise<ReadableStream<UIMessageChunk>> {
    // An immediately-closed stream: useChat processes zero chunks and
    // returns to "ready" without appending an assistant message, so
    // sending is a no-op. To emit a placeholder reply instead, enqueue
    // {type:"start"}, {type:"text-start",id}, {type:"text-delta",id,delta},
    // {type:"text-end",id}, {type:"finish"} before closing.
    return Promise.resolve(
      new ReadableStream<UIMessageChunk>({
        start(controller) {
          controller.close();
        },
      })
    );
  }

  reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return Promise.resolve(null);
  }
}
