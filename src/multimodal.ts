export type ImagePart = {
  type: "image_url";
  image_url: { url: string; detail: "auto" };
};
export function imageMessage(text: string, images: string[]) {
  return images.length
    ? [
        { type: "text", text: text || "Describe the attached image." },
        ...images.map((url) => ({
          type: "image_url" as const,
          image_url: { url, detail: "auto" as const },
        })),
      ]
    : text;
}
/** Persist metadata only, never screenshot/image bytes in task or diagnostic records. */
export function withoutImageData<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (key, item) =>
      key === "imageData"
        ? undefined
        : typeof item === "string" && /^data:image\//.test(item)
          ? "[Image bytes omitted; reload the attachment or capture a fresh screenshot.]"
          : item,
    ),
  );
}
/** Count text without treating base64 data as conversation context. */
export function contextWeight(message: any): number {
  return JSON.stringify(withoutImageData(message)).length;
}
export function hasImageInput(messages: any[]) {
  return messages.some(
    (m) =>
      Array.isArray(m.content) &&
      m.content.some((part: any) => part.type === "image_url"),
  );
}
