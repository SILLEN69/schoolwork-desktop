import { describe, it, expect, vi } from "vitest";
import {
  TelegramLink,
  TelegramUserError,
  telegramChunks,
  type TelegramInput,
} from "./telegram";
import { z } from "zod";
function setup() {
  const map = new Map<string, string>();
  const command = vi.fn(async () => "command result");
  const conversation = vi.fn(
    async (_input: TelegramInput) => "gotchu, task queued",
  );
  const fetcher = vi.fn(async (_url: any, init: any) => {
    const method = String(_url).split("/").at(-1);
    if (method === "getUpdates")
      return new Promise<Response>((_, reject) =>
        init.signal.addEventListener(
          "abort",
          () => reject(new Error("abort")),
          { once: true },
        ),
      );
    return Response.json({
      ok: true,
      result:
        method === "getMe" ? { username: "TestSchoolBot" } : { message_id: 1 },
    });
  });
  const link = new TelegramLink(
    {
      getMetadata: (k) => map.get(k),
      setMetadata: (k, v) => {
        map.set(k, v);
      },
    },
    () => "123456789:never-print-real-token",
    command,
    fetcher as typeof fetch,
    conversation,
  );
  return { map, link, command, fetcher, conversation };
}
async function pair(link: TelegramLink) {
  const p = await link.pair();
  await link.handleUpdate({
    update_id: 1,
    message: {
      chat: { id: 10, type: "private" },
      from: { id: 20 },
      text: "/start " + new URL(p.url).searchParams.get("start"),
    },
  });
}
describe("Telegram private phone link", () => {
  it("authenticates chat AND sender; ignores group and duplicate commands", async () => {
    const { link, command, map } = setup();
    await pair(link);
    expect(link.status().paired).toBe(true);
    const update = (id: number, user: number, type = "private") => ({
      update_id: id,
      message: { chat: { id: 10, type }, from: { id: user }, text: "/retry" },
    });
    await link.handleUpdate(update(2, 21));
    await link.handleUpdate(update(3, 20, "group"));
    expect(command).not.toHaveBeenCalled();
    await link.handleUpdate(update(4, 20));
    await link.handleUpdate(update(4, 20));
    expect(command).toHaveBeenCalledOnce();
    expect(map.get("telegram:offset")).toBe("5");
    link.stop();
  });
  it("supports authenticated task buttons and generic privacy-preserving notifications", async () => {
    const { link, command, fetcher } = setup();
    await pair(link);
    const id = "55ce5a18-a66d-43d2-b003-a1b72a51ebf4";
    await link.handleUpdate({
      update_id: 2,
      callback_query: {
        id: "cb",
        from: { id: 20 },
        message: { chat: { id: 10, type: "private" } },
        data: "retry:" + id,
      },
    });
    expect(command).toHaveBeenCalledWith("retry", id);
    link.notify("once", id, "done", true);
    link.notify("once", id, "done", true);
    await new Promise((r) => setTimeout(r, 0));
    const sent = fetcher.mock.calls
      .filter(([url]) => String(url).endsWith("/sendMessage"))
      .map(([, init]) => JSON.parse(init.body));
    expect(sent.filter((m) => m.text.includes("brochaho"))).toHaveLength(1);
    expect(JSON.stringify(sent)).not.toContain("data:image");
    expect(
      sent.at(-1).reply_markup.inline_keyboard[0][0].callback_data.length,
    ).toBeLessThanOrEqual(64);
    link.stop();
  });
  it("does not leak a token-bearing URL from failures", async () => {
    const { map, command } = setup();
    const l = new TelegramLink(
      {
        getMetadata: (k) => map.get(k),
        setMetadata: (k, v) => {
          map.set(k, v);
        },
      },
      () => "SECRET",
      command,
      vi.fn(async () => {
        throw new Error("https://api.telegram.org/botSECRET/getMe");
      }),
    );
    await expect(l.pair()).rejects.toThrow("Telegram connection failed");
    expect(l.status().error).not.toContain("SECRET");
    l.stop();
  });
  it("rejects unpaired commands and invalid pairing codes", async () => {
    const { link, command } = setup();
    await link.handleUpdate({
      update_id: 9,
      message: {
        chat: { id: 10, type: "private" },
        from: { id: 20 },
        text: "/start wrong",
      },
    });
    expect(link.status().paired).toBe(false);
    expect(command).not.toHaveBeenCalled();
    link.stop();
  });
});

const message = (update_id: number, body: any = {}) => ({
  update_id,
  message: {
    chat: { id: 10, type: "private" },
    from: { id: 20 },
    text: "try another approach",
    ...body,
  },
});
describe("Telegram two-way chat and images", () => {
  it("queues final replies while paused and delivers them on re-enable", async () => {
    const { link, fetcher } = setup();
    await pair(link);
    link.stop();
    link.notify(
      "paused-answer",
      "task",
      "done",
      false,
      "saved while phone link paused",
      link.session(),
    );
    expect(link.status().pending).toBe(1);
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain(
      "saved while phone link paused",
    );
    link.start();
    // Deterministic polling fixture is intentionally pending; explicitly allow its first poll.
    fetcher.mockImplementation(async () =>
      Response.json({ ok: true, result: [] }),
    );
    await (link as any).flush();
    expect(link.status().pending).toBe(0);
    expect(JSON.stringify(fetcher.mock.calls)).toContain(
      "saved while phone link paused",
    );
    link.stop();
  });
  it("retains pairing, conversation and reply routing across a link restart", async () => {
    const { link, map, command, fetcher, conversation } = setup();
    await pair(link);
    link.selectConversation("saved-conversation");
    const session = link.session();
    link.notify("saved", "saved-task", "done");
    await new Promise((r) => setTimeout(r, 0));
    link.stop();
    const restarted = new TelegramLink(
      {
        getMetadata: (k) => map.get(k),
        setMetadata: (k, v) => {
          map.set(k, v);
        },
      },
      () => "fixture",
      command,
      fetcher as typeof fetch,
      conversation,
    );
    restarted.start();
    expect(restarted.session()).toBe(session);
    expect(restarted.selectedConversation()).toBe("saved-conversation");
    await restarted.handleUpdate(
      message(2, { reply_to_message: { message_id: 1 } }),
    );
    expect(conversation).toHaveBeenCalledWith(
      expect.objectContaining({ replyTaskId: "saved-task", session }),
    );
    restarted.stop();
  });
  it("re-pairing aborts the previous session and drops its pending private replies", async () => {
    const { link, conversation, map } = setup();
    await pair(link);
    await link.handleUpdate(message(2));
    const old = conversation.mock.calls[0][0];
    map.set(
      "telegram:outbox",
      JSON.stringify([
        {
          id: "old",
          taskId: "old",
          text: "private",
          tries: 0,
          after: Date.now() + 60000,
          session: old.session,
        },
      ]),
    );
    const p = await link.pair();
    await link.handleUpdate(
      message(3, {
        from: { id: 99 },
        text: "/start " + new URL(p.url).searchParams.get("start"),
      }),
    );
    expect(old.signal.aborted).toBe(true);
    expect(link.session()).not.toBe(old.session);
    expect(map.get("telegram:outbox")).toBe("[]");
    expect(link.selectedConversation()).toBe("");
    link.stop();
  });
  it("disconnect cancels an in-flight image download before task submission", async () => {
    const { link, fetcher, conversation } = setup();
    await pair(link);
    await link.handleUpdate(message(2));
    const signal = conversation.mock.calls[0][0].signal;
    fetcher.mockImplementation(async (url: any, init: any) => {
      if (!String(url).includes("/file/bot"))
        return Response.json({
          ok: true,
          result: { file_path: "photos/file.png" },
        });
      return new Promise<Response>((_, reject) =>
        init.signal.addEventListener(
          "abort",
          () => reject(new Error("SECRET URL")),
          { once: true },
        ),
      );
    });
    const downloading = link.downloadImage(
      { fileId: "x", name: "x" },
      signal,
    );
    await new Promise((r) => setTimeout(r, 0));
    link.disconnect();
    await expect(downloading).rejects.toThrow("Image download failed");
  });
  it("accepts natural language once with a valid stable UUID, same session and cancellation signal", async () => {
    const { link, conversation } = setup();
    await pair(link);
    await link.handleUpdate(message(2));
    await link.handleUpdate(message(2));
    expect(conversation).toHaveBeenCalledOnce();
    const input = conversation.mock.calls[0][0] as any;
    expect(input.text).toBe("try another approach");
    expect(z.string().uuid().safeParse(input.requestId).success).toBe(true);
    expect(input.session).toBe(link.session());
    expect(input.signal.aborted).toBe(false);
    link.stop();
    expect(input.signal.aborted).toBe(true);
  });
  it("never passes messages or photos from other senders/groups to the AI", async () => {
    const { link, conversation } = setup();
    await pair(link);
    await link.handleUpdate(message(2, { from: { id: 999 } }));
    await link.handleUpdate(
      message(3, {
        chat: { id: 10, type: "group" },
        photo: [{ file_id: "x" }],
      }),
    );
    expect(conversation).not.toHaveBeenCalled();
    link.stop();
  });
  it("selects the largest bounded photo and preserves its caption", async () => {
    const { link, conversation } = setup();
    await pair(link);
    await link.handleUpdate(
      message(2, {
        text: undefined,
        caption: "what is this?",
        photo: [
          { file_id: "small", width: 40, height: 40, file_size: 200 },
          { file_id: "large", width: 1600, height: 900, file_size: 1000 },
          {
            file_id: "too-big",
            width: 6000,
            height: 4000,
            file_size: 11000000,
          },
        ],
      }),
    );
    expect(conversation).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "what is this?",
        image: { fileId: "large", bytes: 1000, name: "Telegram photo.jpg" },
      }),
    );
    link.stop();
  });
  it("accepts PNG/JPEG document uploads without trusting their filename", async () => {
    const { link, conversation } = setup();
    await pair(link);
    await link.handleUpdate(
      message(2, {
        text: undefined,
        document: {
          file_id: "png",
          mime_type: "image/png",
          file_name: "../../secret.exe",
          file_size: 500,
        },
      }),
    );
    expect(conversation).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "",
        image: { fileId: "png", bytes: 500, name: "Telegram image" },
      }),
    );
    link.stop();
  });
  it("rejects albums, other documents, voice and unknown slash commands without AI tasks", async () => {
    const { link, conversation, command, fetcher } = setup();
    await pair(link);
    await link.handleUpdate(
      message(2, { media_group_id: "album", photo: [{ file_id: "x" }] }),
    );
    await link.handleUpdate(
      message(3, { document: { mime_type: "application/pdf" } }),
    );
    await link.handleUpdate(message(4, { text: undefined, voice: {} }));
    await link.handleUpdate(message(5, { text: "/delete all" }));
    expect(conversation).not.toHaveBeenCalled();
    expect(command).not.toHaveBeenCalled();
    expect(JSON.stringify(fetcher.mock.calls)).toContain(
      "Albums aren’t supported",
    );
    link.stop();
  });
  it("routes /new and /use commands separately from natural language", async () => {
    const { link, command, conversation } = setup();
    await pair(link);
    const id = "55ce5a18-a66d-43d2-b003-a1b72a51ebf4";
    await link.handleUpdate(message(2, { text: "/new" }));
    await link.handleUpdate(message(3, { text: "/use " + id }));
    expect(command).toHaveBeenNthCalledWith(1, "new", "");
    expect(command).toHaveBeenNthCalledWith(2, "use", id);
    expect(conversation).not.toHaveBeenCalled();
    link.stop();
  });
  it("maps a reply to a delivered notification to the original task", async () => {
    const { link, conversation } = setup();
    await pair(link);
    const id = "55ce5a18-a66d-43d2-b003-a1b72a51ebf4";
    link.notify("reply-test", id, "done");
    await new Promise((r) => setTimeout(r, 0));
    await link.handleUpdate(
      message(2, { reply_to_message: { message_id: 1 } }),
    );
    expect(conversation).toHaveBeenCalledWith(
      expect.objectContaining({ replyTaskId: id }),
    );
    link.stop();
  });
  it("splits long Unicode answers without breaking surrogate pairs or exceeding Telegram limits", () => {
    const text = "hi 😎 ".repeat(1300) + "<b>plain</b>";
    const chunks = telegramChunks(text);
    expect(chunks.join("")).toBe(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(
      chunks.every((c) => c.length <= 3500 && !/[\uD800-\uDBFF]$/.test(c)),
    ).toBe(true);
  });
  it("delivers subscribed answers, ignores old phone sessions and clears private outbox on disconnect", async () => {
    const { link, map, fetcher } = setup();
    await pair(link);
    link.notify(
      "wrong-session",
      "task",
      "done",
      false,
      "private-old",
      "old-session",
    );
    link.notify(
      "answer",
      "task",
      "done",
      false,
      "yo result " + "😎".repeat(2000),
      link.session(),
    );
    await new Promise((r) => setTimeout(r, 0));
    const sent = fetcher.mock.calls
      .filter(([url]) => String(url).endsWith("/sendMessage"))
      .map(([, init]) => JSON.parse(init.body));
    expect(sent.some((s) => s.text.includes("private-old"))).toBe(false);
    expect(sent.filter((s) => s.reply_markup?.inline_keyboard?.[0]?.[0]?.callback_data==='status:task')).toHaveLength(2);
    expect(sent.every(s=>!s.text.includes('Task:'))).toBe(true);
    expect(sent.every((s) => !s.parse_mode && s.text.length <= 4096)).toBe(
      true,
    );
    link.disconnect();
    expect(map.get("telegram:outbox")).toBe("[]");
    expect(link.session()).toBe("");
  });
  it("consumes failed submissions without replay and only exposes explicitly safe errors", async () => {
    const { link, conversation, fetcher } = setup();
    await pair(link);
    conversation.mockRejectedValueOnce(
      new TelegramUserError("yo, busy; stop then resend"),
    );
    await link.handleUpdate(message(2));
    await link.handleUpdate(message(2));
    conversation.mockRejectedValueOnce(
      new Error("https://api.telegram.org/botSECRET/private.png"),
    );
    await link.handleUpdate(message(3));
    expect(conversation).toHaveBeenCalledTimes(2);
    const sent = fetcher.mock.calls
      .filter(([url]) => String(url).endsWith("/sendMessage"))
      .map(([, init]) => JSON.parse(init.body).text)
      .join("\n");
    expect(sent).toContain("busy; stop then resend");
    expect(sent).not.toContain("SECRET");
    link.stop();
  });
  it("downloads via getFile and the fixed Telegram host with bounded bytes", async () => {
    const { link, fetcher } = setup();
    await pair(link);
    fetcher.mockImplementation(async (url: any) =>
      String(url).includes("/file/bot")
        ? new Response(new Uint8Array([1, 2, 3]))
        : Response.json({
            ok: true,
            result: { file_path: "photos/file_1.jpg", file_size: 3 },
          }),
    );
    const buffer = await link.downloadImage(
      { fileId: "photo", bytes: 3, name: "x" },
      new AbortController().signal,
    );
    expect([...buffer]).toEqual([1, 2, 3]);
    expect(fetcher.mock.calls.at(-1)?.[1]).toMatchObject({ redirect: "error" });
    link.stop();
  });
  it.each([
    "../secret.png",
    "https://evil.test/x.png",
    "/local/image.png",
    "photos/../x.png",
  ])("rejects unsafe getFile path %s", async (file_path) => {
    const { link, fetcher } = setup();
    await pair(link);
    fetcher.mockResolvedValue(
      Response.json({ ok: true, result: { file_path } }),
    );
    await expect(
      link.downloadImage(
        { fileId: "photo", name: "x" },
        new AbortController().signal,
      ),
    ).rejects.toThrow("unavailable");
    link.stop();
  });
  it("rejects declared and streaming oversize downloads", async () => {
    const { link, fetcher } = setup();
    await pair(link);
    await expect(
      link.downloadImage(
        { fileId: "x", bytes: 11000000, name: "x" },
        new AbortController().signal,
      ),
    ).rejects.toThrow("10 MB");
    fetcher.mockImplementation(async (url: any) =>
      String(url).includes("/file/bot")
        ? new Response(new Uint8Array(10 * 1024 * 1024 + 1))
        : Response.json({ ok: true, result: { file_path: "photos/file.jpg" } }),
    );
    await expect(
      link.downloadImage(
        { fileId: "x", name: "x" },
        new AbortController().signal,
      ),
    ).rejects.toThrow("10 MB");
    link.stop();
  });
});
