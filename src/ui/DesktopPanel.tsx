import { useEffect, useState } from "react";
import { Monitor, RefreshCw, Square } from "lucide-react";
import type {
  Attachment,
  Capabilities,
  DesktopWindow,
  DesktopDisplay,
} from "../capabilities";

export default function DesktopPanel({
  conversationId,
  swedish,
  capabilities,
  onCapture,
  onStop,
}: {
  conversationId: string;
  swedish: boolean;
  capabilities?: Capabilities;
  onCapture: (attachment: Attachment) => void;
  onStop: () => void;
}) {
  const [windows, setWindows] = useState<DesktopWindow[]>([]),
    [image, setImage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [displays, setDisplays] = useState<DesktopDisplay[]>([]);
  const t = (en: string, sv: string) => (swedish ? sv : en);
  const refresh = async () => {
    try {
      setWindows(await window.schoolwork.desktopWindows());
      setDisplays(
        capabilities?.viewScreen
          ? await window.schoolwork.desktopDisplays()
          : [],
      );
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  };
  useEffect(() => {
    setImage("");
    void refresh();
    return window.schoolwork.onEvent((event) => {
      if (
        event.conversationId === conversationId &&
        event.type === "screenshot"
      )
        setImage(event.imageData);
    });
  }, [
    conversationId,
    capabilities?.allApps,
    capabilities?.viewScreen,
    capabilities?.controlScreen,
    capabilities?.allowedApps.join("|"),
  ]);
  const capture = async (windowId?: string, displayId?: string) => {
    setBusy(true);
    setError("");
    try {
      const attachment = await window.schoolwork.captureScreen({
        conversationId,
        windowId,
        displayId,
      });
      onCapture(attachment);
      setImage(
        await window.schoolwork.readImage({
          conversationId,
          id: attachment.id,
        }),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
      <div className="desktop-status">
        <Monitor size={16} />
        <span>
          {capabilities?.controlScreen
            ? t("Screen control available", "Skärmkontroll tillgänglig")
            : t("Screen control stopped", "Skärmkontroll stoppad")}
        </span>
      </div>
      <p className="panel-hint">
        {capabilities?.allApps
          ? t(
              "All ordinary Windows apps are available. Select a monitor or a window to attach a screenshot. OS security and focus limits still apply.",
              "Alla vanliga Windows-appar är tillgängliga. Välj en skärm eller ett fönster för att bifoga en bild. Windows säkerhets- och fokusbegränsningar gäller.",
            )
          : t(
              "Select a window to capture it and attach it to your message. The agent can use applications selected in Settings.",
              "Välj ett fönster för att ta en bild och bifoga den. AI:n kan använda appar valda i Inställningar.",
            )}
      </p>
      <button
        className="panel-action"
        disabled={busy}
        onClick={() => void refresh()}
      >
        <RefreshCw size={14} />
        {t("Refresh windows", "Uppdatera fönster")}
      </button>{" "}
      <button className="panel-action" onClick={onStop}>
        <Square size={14} />
        {t("Stop control", "Stoppa kontroll")}
      </button>
      {error && (
        <p className="panel-error" role="alert">
          {error}
        </p>
      )}
      {displays.map((display, index) => (
        <button
          className="desktop-window"
          key={display.displayId}
          disabled={busy || !capabilities?.viewScreen}
          onClick={() => void capture(undefined, display.displayId)}
        >
          <strong>
            {t("Monitor", "Skärm")} {index + 1}
            {display.primary ? t(" · primary", " · huvudskärm") : ""}
          </strong>
          <small>
            {display.width} × {display.height} · ({display.left}, {display.top})
          </small>
        </button>
      ))}
      {windows.map((window) => (
        <button
          key={window.windowId}
          className="desktop-window"
          disabled={
            busy || !capabilities?.viewScreen || !capabilities?.controlScreen
          }
          onClick={() => void capture(window.windowId)}
        >
          <strong>{window.title}</strong>
          <small>
            {window.appId.split(/[\\/]/).pop()} · {window.width} ×{" "}
            {window.height}
          </small>
        </button>
      ))}
      {!windows.length && (
        <p className="panel-hint">
          {t(
            "No selected application windows are open.",
            "Inga fönster från valda appar är öppna.",
          )}
        </p>
      )}
      <button
        className="panel-action"
        disabled={busy || !capabilities?.viewScreen}
        onClick={() => void capture()}
      >
        <Monitor size={14} />
        {busy
          ? t("Capturing…", "Tar skärmbild…")
          : t("Capture screen", "Ta skärmbild")}
      </button>
      {image && (
        <img
          className="desktop-screenshot"
          src={image}
          alt={t("Latest screen capture", "Senaste skärmbilden")}
        />
      )}
      <p className="panel-hint">
        {t(
          "Ctrl + Alt + Escape stops desktop work from any application.",
          "Ctrl + Alt + Escape stoppar skärmkontroll från alla appar.",
        )}
      </p>
    </section>
  );
}
