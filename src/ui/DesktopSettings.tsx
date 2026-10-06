import { useEffect, useState } from "react";
import type { Capabilities } from "../capabilities";

export default function DesktopSettings({
  capabilities,
  model,
  profile,
  swedish,
  refresh,
}: {
  capabilities?: Capabilities;
  model: string;
  profile?: { status: string; detail?: string };
  swedish: boolean;
  refresh: () => Promise<void>;
}) {
  const [apps, setApps] = useState<Array<{ appId: string; name: string }>>([]),
    [error, setError] = useState(""),
    [testing, setTesting] = useState(false);
  const t = (en: string, sv: string) => (swedish ? sv : en);
  const [lessons, setLessons] = useState<any[]>([]);
  useEffect(() => {
    void window.schoolwork
      .desktopLessons()
      .then(setLessons)
      .catch(() => {});
    window.schoolwork
      .desktopApps()
      .then(setApps)
      .catch((e: any) => setError(e.message));
  }, []);
  const update = async (next: Capabilities) => {
    try {
      await window.schoolwork.setCapabilities(next);
      await refresh();
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  };
  return (
    <div className="setting-block">
      <label>{t("Applications & screen", "Appar och skärm")}</label>
      <p>
        {t(
          "All desktop tools are available by default, without confirmation dialogs. The AI can release screen input when finished; your Stop always wins. You can restrict access below.",
          "Alla skärmverktyg är tillgängliga som standard, utan bekräftelser. AI:n kan släppa skärminmatning när den är klar; ditt Stopp gäller alltid. Du kan begränsa åtkomst nedan.",
        )}
      </p>
      {capabilities && (
        <>
          <label className="capability-toggle">
            <input
              type="checkbox"
              checked={capabilities.allApps}
              onChange={(e) =>
                void update({ ...capabilities, allApps: e.target.checked })
              }
            />
            {t(
              "All applications · normal Windows permissions",
              "Alla appar · vanliga Windows-behörigheter",
            )}
          </label>
          <p>
            {t(
              "All-app mode removes the app allowlist. It does not bypass UAC, the lock screen, protected video, or higher-integrity windows. Stop remains available.",
              "Alla-appar-läget tar bort applistan. Det kringgår inte UAC, låsskärmen, skyddad video eller högre behörigheter. Stopp fungerar fortfarande.",
            )}
          </p>
          {(
            [
              ["launchApps", t("Launch applications", "Starta appar")],
              ["viewScreen", t("View screen", "Se skärmen")],
              [
                "controlScreen",
                t("Control mouse & keyboard", "Styra mus och tangentbord"),
              ],
            ] as const
          ).map(([key, label]) => (
            <label className="capability-toggle" key={key}>
              <input
                type="checkbox"
                checked={capabilities[key]}
                onChange={(e) =>
                  void update({ ...capabilities, [key]: e.target.checked })
                }
              />
              {label}
            </label>
          ))}
          {[
            ...new Map(
              [
                ...apps,
                ...capabilities.allowedApps.map((appId) => ({
                  appId,
                  name: appId.split(/[\\/]/).pop() || appId,
                })),
              ].map((a) => [a.appId, a]),
            ).values(),
          ].map((application) => (
            <label className="capability-app" key={application.appId}>
              <input
                type="checkbox"
                disabled={capabilities.allApps}
                checked={capabilities.allowedApps.includes(application.appId)}
                onChange={(e) =>
                  void update({
                    ...capabilities,
                    allowedApps: e.target.checked
                      ? [...capabilities.allowedApps, application.appId]
                      : capabilities.allowedApps.filter(
                          (id) => id !== application.appId,
                        ),
                  })
                }
              />
              <span title={application.appId}>{application.name}</span>
            </label>
          ))}
          <button
            className="panel-action"
            onClick={async () => {
              try {
                await window.schoolwork.chooseApplication();
                await refresh();
              } catch (e: any) {
                setError(e.message);
              }
            }}
          >
            {t("Add application…", "Lägg till app…")}
          </button>
        </>
      )}
      <p>
        {t(
          "These switches govern desktop tools. PowerShell and process tools still have your Windows user permissions.",
          "Inställningarna styr skärmverktygen. PowerShell och processverktyg körs fortfarande med dina Windows-behörigheter.",
        )}
      </p>
      <button
        className="panel-action"
        onClick={async () => {
          await window.schoolwork.forgetDesktopLessons();
          setLessons([]);
          await refresh();
        }}
      >
        {t(
          "Forget learned screen recovery patterns",
          "Glöm inlärda skärmmönster",
        )}
      </button>
      <details className="panel-hint">
        <summary>
          {lessons.length}{" "}
          {t("learned recovery patterns", "inlärda återhämtningsmönster")}
        </summary>
        {lessons.slice(0, 10).map((lesson, index) => (
          <p key={index}>
            {lesson.app.split(/[\\/]/).pop()} · {lesson.tool}: {lesson.failure}
            <br />
            {lesson.recovery.join(" → ")} · {lesson.successes}{" "}
            {t("observed recoveries", "observerade återhämtningar")}
          </p>
        ))}
      </details>
      <p>
        {t(
          "Learns successful primitive recoveries after a fresh observation. Patterns retain app identity, monitor layout and task evidence, never screenshots or typed text. They are hints to revalidate, not self-modifying code or permission.",
          "Lär sig lyckade verktygsåterhämtningar efter en ny observation. Mönster sparar app, skärmlayout och uppgiftsevidens — inte skärmbilder eller skriven text. De måste kontrolleras igen och ändrar inte kod eller behörighet.",
        )}
      </p>
      <label>{t("Image understanding", "Bildförståelse")}</label>
      <p>
        {t("Vision support", "Bildstöd")}:{" "}
        {profile?.status || t("not tested", "inte testat")}
        {profile?.detail && " · " + profile.detail}
      </p>
      <button
        className="panel-action"
        disabled={testing}
        onClick={async () => {
          setTesting(true);
          try {
            await window.schoolwork.testVision(model);
            await refresh();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setTesting(false);
          }
        }}
      >
        {testing
          ? t("Testing vision…", "Testar bildstöd…")
          : t(
              "Test this model with a sample image",
              "Testa modellen med en provbild",
            )}
      </button>
      {error && (
        <p className="panel-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
