import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { SchoolWorkStore } from "./storage";
import { Attachments, imageHeader } from "./attachments";

vi.mock("electron", () => ({
  nativeImage: {
    createFromBuffer: () => ({
      isEmpty: () => false,
      getSize: () => ({ width: 2, height: 2 }),
      toPNG: () => Buffer.from("normalized png"),
    }),
  },
}));
const directories: string[] = [],
  stores: SchoolWorkStore[] = [];
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
  for (const dir of directories.splice(0))
    fs.rmSync(dir, { recursive: true, force: true });
});
const png = (width = 2, height = 2) => {
  const b = Buffer.alloc(32);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(b);
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
};
async function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "schoolwork-images-"));
  directories.push(dir);
  const store = new SchoolWorkStore(dir);
  stores.push(store);
  const attachments = new Attachments(store, dir);
  await attachments.initialize();
  return { dir, store, attachments };
}

describe("attachment ownership and durability", () => {
  it("rejects unsupported headers, oversized files and pixel bombs before decoding", async () => {
    expect(() => imageHeader(Buffer.alloc(11 * 1024 * 1024))).toThrow("10 MB");
    expect(() => imageHeader(Buffer.alloc(40))).toThrow("PNG or JPEG");
    const { attachments } = await setup();
    await expect(
      attachments.import(crypto.randomUUID(), "large.png", png(100000, 100000)),
    ).rejects.toThrow("megapixel");
    const jpeg = Buffer.alloc(30);
    Buffer.from([255, 216, 255, 192, 0, 17, 8, 0, 20, 0, 30]).copy(jpeg);
    expect(imageHeader(jpeg)).toEqual({
      mime: "image/jpeg",
      height: 20,
      width: 30,
    });
  });
  it("enforces six drafts even during concurrent imports", async () => {
    const { attachments } = await setup(),
      owner = crypto.randomUUID();
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        attachments.import(owner, "image.png", png()),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(6);
    expect(attachments.list(owner)).toHaveLength(6);
  });
  it("binds images atomically and restores saved references, not bytes, after reopening", async () => {
    const { dir, store, attachments } = await setup(),
      owner = crypto.randomUUID();
    const image = await attachments.import(owner, "source.png", png());
    attachments.assertOwned(owner, [image.id]);
    expect(() =>
      attachments.assertOwned(crypto.randomUUID(), [image.id]),
    ).toThrow("another conversation");
    expect(() => attachments.assertOwned(owner, [image.id, image.id])).toThrow(
      "Invalid",
    );
    const task = {
      id: crypto.randomUUID(),
      conversationId: owner,
      clientRequestId: crypto.randomUUID(),
      objective: "Look at image",
      model: "test",
      workspace: dir,
    };
    expect(() =>
      store.startTask({
        ...task,
        attachmentIds: [image.id, crypto.randomUUID()],
      }),
    ).toThrow("ownership changed");
    expect(store.getMessages(owner)).toHaveLength(0);
    expect(attachments.list(owner)[0].messageId).toBeUndefined();
    store.startTask({ ...task, attachmentIds: [image.id] });
    const message = store.getMessages(owner)[0];
    expect(attachments.list(owner, message.id)).toHaveLength(1);
    expect(() => attachments.assertOwned(owner, [image.id])).toThrow(
      "already sent",
    );
    await expect(attachments.remove(image.id, owner)).rejects.toThrow(
      "Only unsent",
    );
    store.close();
    stores.pop();
    const reopened = new SchoolWorkStore(dir);
    stores.push(reopened);
    const restored = new Attachments(reopened, dir);
    await restored.initialize();
    expect(restored.list(owner, message.id)[0].id).toBe(image.id);
    expect(await restored.data(image.id, owner)).toMatch(
      /^data:image\/png;base64,/,
    );
    await expect(restored.data(image.id, crypto.randomUUID())).rejects.toThrow(
      "unavailable",
    );
  });
  it("expires only drafts and removes owned files on conversation deletion", async () => {
    const { store, attachments } = await setup(),
      owner = crypto.randomUUID();
    const old = await attachments.import(owner, "old.png", png());
    store.db
      .prepare("UPDATE image_attachments SET created_at=? WHERE id=?")
      .run(Date.now() - 2 * 86400000, old.id);
    const orphan = crypto.randomUUID() + ".png";
    fs.writeFileSync(path.join(attachments.root, orphan), "orphan");
    fs.writeFileSync(
      path.join(attachments.root, "keep.txt"),
      "not an owned image",
    );
    await attachments.initialize();
    expect(attachments.list(owner)).toHaveLength(0);
    expect(fs.existsSync(path.join(attachments.root, orphan))).toBe(false);
    expect(fs.existsSync(path.join(attachments.root, "keep.txt"))).toBe(true);
    const next = await attachments.import(owner, "next.png", png());
    await attachments.deleteConversation(owner);
    expect(fs.existsSync(path.join(attachments.root, next.id + ".png"))).toBe(
      false,
    );
  });
});
