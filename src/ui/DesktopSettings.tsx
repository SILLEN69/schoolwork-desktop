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
  useEffect(() => {
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
          "Actions run without confirmation dialogs. Choose the applications the desktop tools can use.",
          "Åtgärder körs utan bekräftelsedialoger. Välj vilka appar skärmverktygen får använda.",
        )}
      </p>
      {capabilities && (
        <>
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
