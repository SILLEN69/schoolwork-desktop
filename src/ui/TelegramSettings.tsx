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
          "Create a bot with @BotFather, add its token here and pair your account. Keep SchoolWork online.",
          "Skapa en bot med @BotFather, ange token här och koppla ditt konto. SchoolWork måste vara online.",
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
          "Paired account only. /new · /status · /retry · /stop. One PNG/JPEG at a time, up to 10 MB/32 MP; requires a vision model.",
          "Bara kopplat konto. /new · /status · /retry · /stop. En PNG/JPEG åt gången, högst 10 MB/32 MP; kräver bildmodell.",
        )}
      </p>
      <p>
        {t(
          "Replies from PC and phone tasks go to Telegram. Messages/photos go to TeachGPT and are saved locally. Bot chats are not Secret Chats. Disconnect keeps saved chats.",
          "Svar från dator- och telefonuppgifter skickas till Telegram. Meddelanden/bilder går till TeachGPT och sparas lokalt. Botchattar är inte hemliga chattar. Frånkoppling behåller sparade chattar.",
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
