import crypto from "node:crypto";
import type { SchoolWorkStore } from "./storage";

type Command = "retry" | "status" | "stop";
type Pair = { chatId: number; userId: number };
type Outgoing = {
  id: string;
  taskId: string;
  text: string;
  tries: number;
  after: number;
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
  }
  resetBot() {
    this.disconnect();
    this.write("offset", 0);
    this.write("seen", []);
  }
  start() {
    if (!this.stopped) return;
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
  ) {
    if (this.stopped || !this.read<Pair | null>("pair", null)) return;
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
    this.write("seen", [...seen, id].slice(-500));
    this.write(
      "outbox",
      [
        ...this.read<Outgoing[]>("outbox", []),
        { id, taskId, text, tries: 0, after: 0 },
      ].slice(-100),
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
      for (const item of this.read<Outgoing[]>("outbox", []).filter(
        (i) => i.after <= Date.now(),
      )) {
        if (generation !== this.generation) return;
        try {
          await this.api(
            "sendMessage",
            {
              chat_id: pair.chatId,
              text: item.text + "\nTask: " + item.taskId.slice(0, 8),
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
      this.pairing = undefined;
      this.write("offset", update.update_id + 1);
      await this.api("sendMessage", {
        chat_id: message.chat.id,
        text: "heyy ur phone is linked 🙌 /status, /retry or /stop + task id. SchoolWork must stay open. No screenshots or chat contents are sent.",
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
    const match = /^(retry|status|stop)(?::([a-f0-9-]{36}))?$/.exec(value);
    // Persist consumption BEFORE executing: a crash must not replay a desktop command.
    this.write("offset", update.update_id + 1);
    if (cb)
      await this.api("answerCallbackQuery", { callback_query_id: cb.id }).catch(
        () => {},
      );
    if (this.stopped || generation !== this.generation) return;
    const reply = match
      ? await this.command(match[1] as Command, match[2] || "").catch(
          () =>
            "yo, couldn’t do that. Check SchoolWork; no input was automatically repeated.",
        )
      : "yo, use /status, /retry or /stop (optional full task id).";
    await this.api("sendMessage", {
      chat_id: pair.chatId,
      text: reply.slice(0, 3000),
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
