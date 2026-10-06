import { useEffect, useState } from "react";
export default function TelegramSettings({ swedish }: { swedish: boolean }) {
  const [token, setToken] = useState(""),
    [status, setStatus] = useState<any>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const t = (en: string, sv: string) => (swedish ? sv : en);
  const refresh = async () =>
    setStatus(await window.schoolwork.telegramStatus());
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh().catch(() => {}), 4000);
    return () => clearInterval(timer);
  }, []);
  const action = async (run: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await run();
      await refresh();
    } catch (e: any) {
      setError(
        String(e.message).replace(
          /^Error invoking remote method.*?: Error: /,
          "",
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="setting-block telegram-settings">
      <label>Telegram · {t("phone link", "telefonkoppling")}</label>
      <p>
        {t(
          "Create a bot with @BotFather in Telegram. Paste its token here (never in chat), then link your private account. Send messages and PNG/JPEG photos to the AI from your phone. SchoolWork and your PC must stay on and online.",
          "Skapa en bot med @BotFather i Telegram. Klistra in token här (aldrig i chatten), och koppla ditt privata konto. Skicka meddelanden och PNG/JPEG-bilder till AI:n från telefonen. SchoolWork och datorn måste vara på och online.",
        )}
      </p>
      <input
        type="password"
        autoComplete="off"
        aria-label="Telegram bot token"
        placeholder={
          status.configured
            ? t("Token saved securely", "Token sparad säkert")
            : "123456789:…"
        }
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
      <div className="telegram-actions">
        <button
          className="panel-action"
          disabled={busy || (!token && !status.configured)}
          onClick={() =>
            void action(async () => {
              await window.schoolwork.telegramConfigure({
                token: token || undefined,
                enabled: true,
              });
              setToken("");
            })
          }
        >
          {t("Save & enable", "Spara och aktivera")}
        </button>
        <button
          className="panel-action"
          disabled={busy || !status.configured}
          onClick={() =>
            void action(async () => {
              const pair = await window.schoolwork.telegramPair();
              await window.schoolwork.openUrl(pair.url);
            })
          }
        >
          {t("Link phone", "Koppla telefon")}
        </button>
        <button
          className="panel-action"
          disabled={busy || !status.paired || !status.enabled}
          onClick={() => void action(() => window.schoolwork.telegramTest())}
        >
          {t("Send test", "Skicka test")}
        </button>
        <button
          className="panel-action"
          disabled={busy || !status.enabled}
          onClick={() =>
            void action(() =>
              window.schoolwork.telegramConfigure({ enabled: false }),
            )
          }
        >
          {t("Pause link", "Pausa koppling")}
        </button>
        <button
          className="panel-action"
          disabled={busy || !status.configured}
          onClick={() =>
            void action(() => window.schoolwork.telegramDisconnect())
          }
        >
          {t("Disconnect & delete token", "Koppla från och radera token")}
        </button>
      </div>
      <p role="status">
        {status.paired
          ? t("Phone paired", "Telefon kopplad")
          : t("Not paired", "Inte kopplad")}{" "}
        · {status.enabled ? t("Listening", "Lyssnar") : t("Off", "Av")} ·{" "}
        {status.pending || 0} {t("pending messages", "väntande meddelanden")}
      </p>
      <p>
        {t(
          "Only your paired account can chat or control tasks. /new starts fresh; reply to a notification or /use <full task id> to continue a desktop chat. /status, /retry and /stop still work. Send photos individually with an optional caption (under 10 MB, max 32 MP); albums/voice/video aren’t supported. The chat’s selected model must support vision. Busy chat? Stop first and resend, or /new.",
          "Bara ditt kopplade konto kan chatta eller styra uppgifter. /new startar nytt; svara på en notis eller /use <fullständigt uppgifts-id> för att fortsätta en datorchatt. /status, /retry och /stop fungerar fortfarande. Skicka en bild åt gången, gärna med bildtext (under 10 MB, max 32 MP); album/röst/video stöds inte. Chattens valda modell måste stödja bilder. Upptagen chatt? Stoppa och skicka igen, eller /new.",
        )}
      </p>
      <p>
        {t(
          "Phone messages/photos are saved in SchoolWork and sent to TeachGPT. When linked, actual final replies from desktop and phone tasks go through Telegram, including results or error explanations—not just generic status. Actions get short result replies; questions can get detailed answers. Screenshots aren’t automatically uploaded to Telegram. Bot chats aren’t Secret Chats: don’t send sensitive data. Disconnect clears the link and pending replies, not saved chats/photos.",
          "Telefonmeddelanden/bilder sparas i SchoolWork och skickas till TeachGPT. När telefonen är kopplad skickas riktiga slutsvar från både dator- och telefonuppgifter via Telegram, inklusive resultat eller fel—inte bara generell status. Åtgärder får korta resultatsvar; frågor kan få utförliga svar. Skärmbilder laddas inte automatiskt upp till Telegram. Botchattar är inte hemliga chattar: skicka inte känslig data. Frånkoppling tar bort kopplingen och väntande svar, inte sparade chattar/bilder.",
        )}
      </p>
      {(error || status.error) && (
        <p role="alert" className="panel-error">
          {error || status.error}
        </p>
      )}
    </div>
  );
}
