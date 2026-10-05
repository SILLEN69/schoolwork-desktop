import { describe, it, expect, vi } from "vitest";
import { TelegramLink } from "./telegram";
function setup() {
  const map = new Map<string, string>();
  const command = vi.fn(async () => "command result");
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
  );
  return { map, link, command, fetcher };
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
