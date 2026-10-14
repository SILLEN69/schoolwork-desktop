import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Attachment } from "../capabilities";
import {useLanguage} from './Language';

function AttachmentImage({ attachment }: { attachment: Attachment }) {
  const {t}=useLanguage();
  const [source, setSource] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    window.schoolwork
      .readImage({
        id: attachment.id,
        conversationId: attachment.conversationId,
      })
      .then((data) => {
        if (!disposed) setSource(data);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
    };
  }, [attachment.id, attachment.conversationId]);
  return source ? (
    <img src={source} alt={attachment.name} title={attachment.name} />
  ) : (
    <span>{failed ? t('Image unavailable','Bilden är inte tillgänglig') : t('Loading image…','Läser bild…')}</span>
  );
}
export default function ImageAttachments({
  attachments,
  remove,
}: {
  attachments: Attachment[];
  remove?: (attachment: Attachment) => void;
}) {
  const {t}=useLanguage();
  if (!attachments.length) return null;
  return (
    <div className={remove ? "attachment-tray" : "message-images"}>
      {attachments.map((attachment) =>
        remove ? (
          <div className="attachment-chip" key={attachment.id}>
            <AttachmentImage attachment={attachment} />
            <span title={attachment.name}>{attachment.name}</span>
            <button
              className="icon"
              type="button"
              aria-label={t('Remove ','Ta bort ') + attachment.name}
              onClick={() => remove(attachment)}
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <AttachmentImage key={attachment.id} attachment={attachment} />
        ),
      )}
    </div>
  );
}

export function imageFileData(file: File): Promise<string> {
  if (
    !["image/png", "image/jpeg"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    return Promise.reject(new Error("Choose a PNG or JPEG under 10 MB."));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.readAsDataURL(file);
  });
}
