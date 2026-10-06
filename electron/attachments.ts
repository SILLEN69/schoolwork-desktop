import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { nativeImage } from "electron";
import type { SchoolWorkStore } from "./storage";
import type { Attachment } from "../src/capabilities";

export const maxImageBytes = 10 * 1024 * 1024;
export function imageHeader(buffer: Buffer) {
  if (buffer.length > maxImageBytes || buffer.length < 24)
    throw new Error("Choose an image under 10 MB.");
  if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return {
      mime: "image/png",
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  if (buffer[0] === 255 && buffer[1] === 216) {
    let offset = 2;
    while (offset + 4 < buffer.length) {
      if (buffer[offset] !== 255) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker) &&
        offset + 9 < buffer.length
      )
        return {
          mime: "image/jpeg",
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      if (length < 2) break;
      offset += length + 2;
    }
  }
  throw new Error("Choose a valid PNG or JPEG image.");
}
export class Attachments {
  readonly root: string;
  private imports: Promise<unknown> = Promise.resolve();
  constructor(
    private store: SchoolWorkStore,
    userData: string,
  ) {
    this.root = path.join(userData, "attachments");
  }
  async initialize() {
    await fs.mkdir(this.root, { recursive: true });
    this.store.db.exec(
      "CREATE TABLE IF NOT EXISTS image_attachments (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, message_id TEXT REFERENCES messages(id) ON DELETE CASCADE, name TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, bytes INTEGER NOT NULL, created_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS attachments_message ON image_attachments(message_id);",
    );
    const expired = this.store.db
      .prepare(
        "SELECT id FROM image_attachments WHERE message_id IS NULL AND created_at < ?",
      )
      .all(Date.now() - 86400000) as any[];
    for (const row of expired) await this.remove(row.id);
    const known = new Set(
      (
        this.store.db.prepare("SELECT id FROM image_attachments").all() as any[]
      ).map((r) => r.id + ".png"),
    );
    // Only generated UUID files in this owned directory can be removed.
    for (const file of await fs.readdir(this.root))
      if (/^[0-9a-f-]{36}\.png$/.test(file) && !known.has(file))
        await fs.rm(path.join(this.root, file), { force: true });
  }
  list(conversationId: string, messageId?: string): Attachment[] {
    const rows = this.store.db
      .prepare(
        "SELECT * FROM image_attachments WHERE conversation_id=?" +
          (messageId ? " AND message_id=?" : "") +
          " ORDER BY created_at",
      )
      .all(
        ...(messageId ? [conversationId, messageId] : [conversationId]),
      ) as any[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      mime: "image/png",
      width: row.width,
      height: row.height,
      bytes: row.bytes,
      conversationId: row.conversation_id,
      messageId: row.message_id || undefined,
      createdAt: row.created_at,
    }));
  }
  import(
    conversationId: string,
    name: string,
    buffer: Buffer,
  ): Promise<Attachment> {
    const operation = () => this.importOne(conversationId, name, buffer);
    const result = this.imports.then(operation, operation);
    this.imports = result.catch(() => {});
    return result;
  }
  private async importOne(
    conversationId: string,
    name: string,
    buffer: Buffer,
  ): Promise<Attachment> {
    const header = imageHeader(buffer);
    if (
      !header.width ||
      !header.height ||
      header.width * header.height > 32_000_000
    )
      throw new Error("Image exceeds the 32 megapixel limit.");
    if (this.list(conversationId).filter((a) => !a.messageId).length >= 6)
      throw new Error("Attach at most six images per message.");
    const decoded = nativeImage.createFromBuffer(buffer);
    if (decoded.isEmpty()) throw new Error("Image could not be decoded.");
    const size = decoded.getSize();
    if (size.width * size.height > 32_000_000)
      throw new Error("Image exceeds the pixel limit.");
    const largest = Math.max(size.width, size.height);
    const scale = Math.min(1, 1600 / largest);
    const image =
      scale < 1
        ? decoded.resize({
            width: Math.round(size.width * scale),
            height: Math.round(size.height * scale),
          })
        : decoded;
    const png = image.toPNG();
    if (png.length > 4 * 1024 * 1024)
      throw new Error("Image is too detailed. Resize it before attaching.");
    const id = crypto.randomUUID(),
      dimensions = image.getSize(),
      createdAt = Date.now();
    await fs.writeFile(path.join(this.root, id + ".png"), png, { flag: "wx" });
    try {
      this.store.db
        .prepare(
          "INSERT INTO image_attachments(id,conversation_id,name,width,height,bytes,created_at) VALUES(?,?,?,?,?,?,?)",
        )
        .run(
          id,
          conversationId,
          name.slice(0, 200),
          dimensions.width,
          dimensions.height,
          png.length,
          createdAt,
        );
    } catch (error) {
      await fs.rm(path.join(this.root, id + ".png"), { force: true });
      throw error;
    }
    return {
      id,
      name: name.slice(0, 200),
      mime: "image/png",
      width: dimensions.width,
      height: dimensions.height,
      bytes: png.length,
      conversationId,
      createdAt,
    };
  }
  assertOwned(conversationId: string, ids: string[]) {
    if (new Set(ids).size !== ids.length || ids.length > 6)
      throw new Error("Invalid attachment list.");
    const available = this.list(conversationId);
    const owned = ids.map((id) =>
      available.find((a) => a.id === id && !a.messageId),
    );
    if (owned.some((a) => !a))
      throw new Error(
        "An attachment belongs to another conversation or was already sent.",
      );
    if (owned.reduce((sum, a) => sum + a!.bytes, 0) > 8 * 1024 * 1024)
      throw new Error("Combined images exceed the 8 MB message limit.");
  }
  bind(conversationId: string, messageId: string, ids: string[]) {
    for (const id of ids)
      this.store.db
        .prepare(
          "UPDATE image_attachments SET message_id=? WHERE id=? AND conversation_id=? AND message_id IS NULL",
        )
        .run(messageId, id, conversationId);
  }
  async data(id: string, conversationId: string) {
    if (!this.list(conversationId).some((a) => a.id === id))
      throw new Error("Attachment is unavailable in this conversation.");
    return (
      "data:image/png;base64," +
      (await fs.readFile(path.join(this.root, id + ".png"))).toString("base64")
    );
  }
  async remove(id: string, conversationId?: string) {
    if (conversationId) {
      const row = this.list(conversationId).find((a) => a.id === id);
      if (!row || row.messageId)
        throw new Error("Only unsent images can be removed from the composer.");
    }
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid attachment ID.");
    await fs.rm(path.join(this.root, id + ".png"), { force: true });
    this.store.db.prepare("DELETE FROM image_attachments WHERE id=?").run(id);
  }
  async deleteConversation(conversationId: string) {
    for (const attachment of this.list(conversationId))
      await this.remove(attachment.id);
  }
}
