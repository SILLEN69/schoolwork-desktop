import crypto from "node:crypto";
import type { SchoolWorkStore } from "./storage";

type Command = "retry" | "status" | "stop" | "new" | "use";
type Pair = { chatId: number; userId: number };
export type TelegramInput = {
  requestId: string;
  text: string;
  image?: { fileId: string; bytes?: number; name: string };
  replyTaskId?: string;
  session: string;
  signal: AbortSignal;
};
const maxPhotoBytes = 10 * 1024 * 1024;
const help =
  "yo, send a message or PNG/JPEG photo + caption and I’ll reply here 🤝 /new starts fresh; reply to a task notification or /use <full task id> to continue it. /status, /retry and /stop still work. SchoolWork must stay open.";
export function telegramChunks(text: string): string[] {
  // No parse_mode: model Markdown, code and malformed HTML cannot break delivery.
  const bounded =
    text.length > 60000
      ? text.slice(0, /[\uD800-\uDBFF]/.test(text[58999]) ? 58999 : 59000) +
        "\n[Long reply shortened. Full result is saved in SchoolWork.]"
      : text;
  const chunks: string[] = [];
  let part = "";
  for (const character of bounded) {
    if (part.length + character.length > 3500) {
      chunks.push(part);
      part = "";
    }
    part += character;
  }
  if (part) chunks.push(part);
  return chunks;
}
type Outgoing = {
  id: string;
  taskId: string;
  text: string;
  tries: number;
  after: number;
  session?: string;
};
export class TelegramLink {
  private controller?: AbortController;
  private stopped = true;
  private generation = 0;
  private pairing?: { code: string; until: number };
  private timer?: ReturnType<typeof setTimeout>;
  private flushing = false;
  private lastError = "";
  constructor(
    private store: Pick<SchoolWorkStore, "getMetadata" | "setMetadata">,
    private token: () => string,
    private command: (verb: Command, taskId: string) => Promise<string>,
    private fetcher: typeof fetch = fetch,
    private conversation?: (input: TelegramInput) => Promise<string>,
  ) {}
  private read<T>(key: string, fallback: T): T {
    try {
      return (
        JSON.parse(this.store.getMetadata("telegram:" + key) || "null") ??
        fallback
      );
    } catch {
      return fallback;
    }
  }
  private write(key: string, value: unknown) {
    this.store.setMetadata("telegram:" + key, JSON.stringify(value));
  }
  status() {
    return {
      configured: Boolean(this.token()),
      paired: Boolean(this.read<Pair | null>("pair", null)),
      enabled: !this.stopped,
      error: this.lastError,
      pending: this.read<Outgoing[]>("outbox", []).length,
    };
  }
  session() {
    return this.read<string>("session", "");
  }
  selectedConversation() {
    return this.read<string>("conversation", "");
  }
  selectConversation(id: string) {
    this.write("conversation", id);
  }
  /** Downloads only authenticated Telegram files; never accept a caller-supplied URL. */
  async downloadImage(
    image: NonNullable<TelegramInput["image"]>,
    signal: AbortSignal,
  ) {
    const generation = this.generation;
    if (
      image.bytes !== undefined &&
      (!Number.isSafeInteger(image.bytes) ||
        image.bytes < 1 ||
        image.bytes > maxPhotoBytes)
    )
      throw new Error("Send a PNG/JPEG image under 10 MB.");
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(30000)]);
    const file = await this.api(
      "getFile",
      { file_id: image.fileId },
      requestSignal,
    );
    if (generation !== this.generation || this.stopped)
      throw new Error("Phone link changed.");
    const filePath = String(file.file_path || "");
    if (
      !/^[A-Za-z0-9_/-]+\.[A-Za-z0-9]+$/.test(filePath) ||
      filePath.split("/").some((p) => !p || p === "." || p === "..") ||
      filePath.startsWith("/") ||
      (file.file_size !== undefined &&
        (!Number.isSafeInteger(file.file_size) ||
          file.file_size > maxPhotoBytes))
    )
      throw new Error("Telegram image is unavailable or exceeds 10 MB.");
    let response: Response;
    try {
      response = await this.fetcher(
        `https://api.telegram.org/file/bot${this.token()}/${filePath}`,
        { signal: requestSignal, redirect: "error" },
      );
    } catch {
      throw new Error("Image download failed. Send the photo again.");
    }
    if (!response.ok || !response.body)
      throw new Error("Image download failed. Send the photo again.");
    const reader = response.body.getReader(),
      parts: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        requestSignal.throwIfAborted();
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxPhotoBytes) throw new Error("Send an image under 10 MB.");
        parts.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    if (generation !== this.generation || this.stopped)
      throw new Error("Phone link changed.");
    return Buffer.concat(parts, size);
  }
  async api(
    method: string,
    body: unknown,
    signal = AbortSignal.timeout(15000),
  ) {
    const token = this.token();
    if (!token) throw new Error("Add a Telegram bot token in Settings.");
    let response: Response;
    try {
      response = await this.fetcher(
        `https://api.telegram.org/bot${token}/${method}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal,
        },
      );
    } catch {
      throw new Error(
        "Telegram connection failed. Check your network and bot token.",
      );
    }
    const data = (await response.json().catch(() => ({}))) as any;
    // Never expose the token-bearing request URL or remote description in diagnostics/UI.
    if (!response.ok || !data.ok)
      throw new Error(
        `Telegram request failed (HTTP ${response.status}). Check the bot token; another app polling this bot can cause conflicts.`,
      );
    return data.result;
  }
  async pair() {
    const token = this.token(),
      generation = this.generation;
    const bot = await this.api("getMe", {});
    if (token !== this.token() || generation !== this.generation)
      throw new Error(
        "Telegram settings changed while pairing. Try linking again.",
      );
    if (!/^[A-Za-z0-9_]+$/.test(bot.username))
      throw new Error("Telegram bot username unavailable.");
    this.pairing = {
      code: crypto.randomBytes(16).toString("hex"),
      until: Date.now() + 5 * 60000,
    };
    this.start();
    return {
      url: `https://t.me/${bot.username}?start=${this.pairing.code}`,
      expiresAt: this.pairing.until,
    };
  }
  disconnect() {
    this.stop();
    this.pairing = undefined;
    this.write("pair", null);
    this.write("outbox", []);
    this.write("session", "");
    this.write("replies", []);
    this.write("conversation", "");
  }
  resetBot() {
    this.disconnect();
    this.write("offset", 0);
    this.write("seen", []);
  }
  start() {
    if (!this.stopped) return;
    if (this.read<Pair | null>("pair", null) && !this.session())
      this.write("session", crypto.randomUUID());
    this.stopped = false;
    const generation = ++this.generation;
    this.controller = new AbortController();
    void this.poll(generation);
  }
  stop() {
    this.stopped = true;
    this.generation++;
    this.controller?.abort();
    if (this.timer) clearTimeout(this.timer);
  }
  notify(
    id: string,
    taskId: string,
    state: "done" | "error" | "paused",
    coding = false,
    answer?: string,
    session?: string,
  ) {
    // Pause suspends delivery, not durable local completion notifications.
    if (!this.read<Pair | null>("pair", null)) return;
    if (session && session !== this.session()) return;
    const seen = this.read<string[]>("seen", []);
    if (seen.includes(id)) return;
    const text =
      state === "done"
        ? coding
          ? "heyyy i did it brochaho 😎 code changes checked. Open SchoolWork for the results + limits."
          : "heyy, task finished 🙌 results are in SchoolWork."
        : state === "paused"
          ? "yo, task paused. progress saved — check SchoolWork or tap status."
          : "yo, hit an error 😭 progress saved. check SchoolWork for details, then tap retry if u want.";
    const chunks = telegramChunks(
      (answer || text).replace(
        /\b\d{5,16}:[A-Za-z0-9_-]{20,100}\b/g,
        "[redacted bot token]",
      ),
    );
    this.write("seen", [...seen, id].slice(-500));
    this.write(
      "outbox",
      [
        ...this.read<Outgoing[]>("outbox", []),
        ...chunks.map((chunk, i) => ({
          id: id + ":" + i,
          taskId,
          text: chunk,
          tries: 0,
          after: 0,
          session: this.session(),
        })),
      ].slice(-200),
    );
    void this.flush().catch(() => {
      this.lastError =
        "Local notification queue could not be updated. Tasks still work locally.";
    });
  }
  private async flush() {
    if (this.flushing || this.stopped) return;
    const pair = this.read<Pair | null>("pair", null);
    if (!pair) return;
    this.flushing = true;
    const generation = this.generation;
    try {
      for (const item of this.read<Outgoing[]>("outbox", [])) {
        if (generation !== this.generation) return;
        if (item.after > Date.now()) break; // Preserve chunk order across delivery retries.
        if (item.session && item.session !== this.session()) {
          this.write(
            "outbox",
            this.read<Outgoing[]>("outbox", []).filter((i) => i.id !== item.id),
          );
          continue;
        }
        try {
          const sent = await this.api(
            "sendMessage",
            {
              chat_id: pair.chatId,
              text: item.text,
              link_preview_options: { is_disabled: true },
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "Status", callback_data: "status:" + item.taskId },
                    {
                      text: "Try again",
                      callback_data: "retry:" + item.taskId,
                    },
                    { text: "Stop", callback_data: "stop:" + item.taskId },
                  ],
                ],
              },
            },
            this.controller
              ? AbortSignal.any([
                  this.controller.signal,
                  AbortSignal.timeout(15000),
                ])
              : AbortSignal.timeout(15000),
          );
          if (generation !== this.generation) return;
          if (Number.isSafeInteger(sent?.message_id))
            this.write(
              "replies",
              [
                ...this.read<any[]>("replies", []),
                { messageId: sent.message_id, taskId: item.taskId },
              ].slice(-1000),
            );
          this.write(
            "outbox",
            this.read<Outgoing[]>("outbox", []).filter((i) => i.id !== item.id),
          );
          this.lastError = "";
        } catch {
          if (generation !== this.generation) return;
          this.lastError =
            "Notification delivery failed; queued for retry. Tasks still work locally.";
          this.write(
            "outbox",
            this.read<Outgoing[]>("outbox", []).map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    tries: i.tries + 1,
                    after:
                      Date.now() +
                      Math.min(300000, 5000 * 2 ** Math.min(i.tries, 6)),
                  }
                : i,
            ),
          );
          break;
        }
      }
    } finally {
      this.flushing = false;
    }
  }
  /** Separate entry point for deterministic authentication/replay tests. */
  async handleUpdate(update: any) {
    if (this.stopped) return;
    const generation = this.generation;
    if (!Number.isSafeInteger(update?.update_id)) return;
    if (update.update_id < this.read<number>("offset", 0)) return;
    const cb = update.callback_query;
    const message = cb?.message || update.message;
    const user = cb?.from || message?.from;
    if (
      message?.chat?.type !== "private" ||
      !Number.isSafeInteger(message.chat.id) ||
      !Number.isSafeInteger(user?.id)
    ) {
      this.write("offset", update.update_id + 1);
      return;
    }
    if (
      !cb &&
      this.pairing &&
      Date.now() < this.pairing.until &&
      message.text === "/start " + this.pairing.code
    ) {
      this.write("pair", { chatId: message.chat.id, userId: user.id });
      this.write("session", crypto.randomUUID());
      this.write("conversation", "");
      this.write("replies", []);
      this.write("outbox", []);
      this.pairing = undefined;
      this.write("offset", update.update_id + 1);
      // Re-pairing cancels downloads/work adapters belonging to the previous phone session.
      this.stop();
      this.start();
      await this.api("sendMessage", {
        chat_id: message.chat.id,
        text:
          "heyy ur phone is linked 🙌 Messages + photos you send go to the AI, and its replies come back here. Other desktop tasks send status only. " +
          help,
      });
      return;
    }
    const pair = this.read<Pair | null>("pair", null);
    if (!pair || pair.chatId !== message.chat.id || pair.userId !== user.id) {
      this.write("offset", update.update_id + 1);
      return;
    }
    const value =
      cb?.data ||
      String(message.text || "")
        .trim()
        .replace(/^\//, "")
        .replace(/\s+/, ":");
    const match = /^(retry|status|stop|new|use)(?::([a-f0-9-]{36}))?$/.exec(
      value,
    );
    // Persist consumption BEFORE executing: a crash must not replay a desktop command.
    this.write("offset", update.update_id + 1);
    if (cb)
      await this.api("answerCallbackQuery", { callback_query_id: cb.id }).catch(
        () => {},
      );
    if (this.stopped || generation !== this.generation) return;
    let reply: string;
    try {
      const text = String(message.text || message.caption || "").trim();
      if (match && !message.photo && !message.document) {
        reply = await this.command(match[1] as Command, match[2] || "");
      } else if (cb || text.startsWith("/")) {
        reply = help;
      } else if (this.conversation) {
        const photo = Array.isArray(message.photo)
          ? message.photo
              .filter(
                (p: any) =>
                  typeof p.file_id === "string" &&
                  (!p.file_size || p.file_size <= maxPhotoBytes),
              )
              .sort(
                (a: any, b: any) => b.width * b.height - a.width * a.height,
              )[0]
          : undefined;
        const document = message.document;
        if (
          document &&
          !["image/png", "image/jpeg"].includes(document.mime_type)
        )
          throw new TelegramUserError(
            "Send a PNG/JPEG photo or image file; other attachments aren’t supported yet.",
          );
        if (message.media_group_id)
          throw new TelegramUserError(
            "Send photos individually, with a caption if you want. Albums aren’t supported yet.",
          );
        if (message.photo && !photo)
          throw new TelegramUserError("Send a photo under 10 MB.");
        const file = photo || document;
        if (!text && !file)
          throw new TelegramUserError(
            "Send text or a PNG/JPEG photo. Voice/video isn’t supported yet.",
          );
        if (
          text.length > 30000 ||
          (file &&
            (typeof file.file_id !== "string" || file.file_id.length > 512))
        )
          throw new TelegramUserError(
            "Message or image identifier is too long.",
          );
        const session = this.session();
        const hash = crypto
          .createHash("sha256")
          .update(session + ":" + update.update_id)
          .digest();
        hash[6] = (hash[6] & 15) | 0x50;
        hash[8] = (hash[8] & 63) | 0x80;
        const requestId = hash
          .toString("hex")
          .slice(0, 32)
          .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
        const replyTaskId = this.read<any[]>("replies", []).find(
          (r) => r.messageId === message.reply_to_message?.message_id,
        )?.taskId;
        reply = await this.conversation({
          requestId,
          text,
          session,
          replyTaskId,
          signal: this.controller!.signal,
          image: file
            ? {
                fileId: file.file_id,
                bytes: file.file_size,
                name: photo ? "Telegram photo.jpg" : "Telegram image",
              }
            : undefined,
        });
      } else reply = help;
    } catch (error) {
      // Only our own validation errors can be disclosed by the conversation adapter.
      reply =
        error instanceof TelegramUserError
          ? error.message
          : "yo, couldn’t accept that. Check SchoolWork; no input was automatically repeated. Send PNG/JPEG photos individually under 10 MB, or text.";
    }
    if (this.stopped || generation !== this.generation) return;
    await this.api("sendMessage", {
      chat_id: pair.chatId,
      text: reply.slice(0, 3000),
      link_preview_options: { is_disabled: true },
    });
  }
  private async poll(generation: number) {
    if (this.stopped || generation !== this.generation) return;
    try {
      const updates = await this.api(
        "getUpdates",
        {
          offset: this.read<number>("offset", 0),
          timeout: 20,
          limit: 20,
          allowed_updates: ["message", "callback_query"],
        },
        AbortSignal.any([this.controller!.signal, AbortSignal.timeout(30000)]),
      );
      for (const update of updates) {
        if (generation !== this.generation) return;
        await this.handleUpdate(update);
      }
      this.lastError = "";
      await this.flush();
    } catch {
      if (generation !== this.generation) return;
      this.lastError =
        "Telegram disconnected. Retrying in the background; local tasks are unaffected.";
    }
    if (!this.stopped && generation === this.generation)
      this.timer = setTimeout(
        () => void this.poll(generation),
        this.lastError ? 5000 : 100,
      );
  }
}
/** Explicitly safe messages, never raw provider/filesystem/token-bearing errors. */
export class TelegramUserError extends Error {}
