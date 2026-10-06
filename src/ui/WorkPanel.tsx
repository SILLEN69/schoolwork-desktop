import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  FileText,
  Folder,
  RefreshCw,
  Search,
  Globe,
  ExternalLink,
} from "lucide-react";
import ActivityLog from "./ActivityLog";
import DesktopPanel from "./DesktopPanel";
import type { Attachment, Capabilities } from "../capabilities";

export default function WorkPanel({
  conversationId,
  swedish,
  workspace,
  capabilities,
  onCapture,
  onStop,
}: {
  conversationId: string;
  swedish: boolean;
  workspace: string;
  capabilities?: Capabilities;
  onCapture: (attachment: Attachment) => void;
  onStop: () => void;
}) {
  const [tab, setTab] = useState("files");
  const [directory, setDirectory] = useState(workspace);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [file, setFile] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("http://localhost:5173");
  const [preview, setPreview] = useState("");
  const generation = useRef(0);
  const t = (en: string, sv: string) => (swedish ? sv : en);
  const load = async (dir = directory, offset = 0, search = query) => {
    const request = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const data = await window.schoolwork.inspectProject({
        conversationId,
        tool: search ? "find_files" : "list_files",
        args: { path: dir, query: search, offset, limit: 80 },
      });
      if (request !== generation.current) return;
      const entries = search
        ? data.matches.map((p: string) => ({
            name: p,
            path: data.root + "/" + p,
            type: "file",
          }))
        : data.entries;
      setRows((old) => (offset ? [...old, ...entries] : entries));
      setDirectory(data.path || data.root);
      setNext(data.nextOffset);
      if (data.scanLimited)
        setError(
          t(
            "Scan limit reached. Search a smaller folder.",
            "Sökgränsen nådd. Välj en mindre mapp.",
          ),
        );
    } catch (e) {
      if (request === generation.current) setError(String(e));
    } finally {
      if (request === generation.current) setBusy(false);
    }
  };
  useEffect(() => {
    setFile(null);
    setRows([]);
    setQuery("");
    setPreview("");
    if (workspace) void load(workspace, 0, "");
    return () => {
      generation.current++;
    };
  }, [conversationId, workspace]);
  useEffect(
    () =>
      window.schoolwork.onEvent((event) => {
        if (
          event.conversationId !== conversationId ||
          event.type !== "tool-result"
        )
          return;
        const candidate = event.payload?.url;
        if (typeof candidate === "string") {
          try {
            const parsed = new URL(candidate);
            if (
              ["localhost", "127.0.0.1"].includes(parsed.hostname) &&
              ["http:", "https:"].includes(parsed.protocol)
            ) {
              setUrl(candidate);
              setPreview(candidate);
              setTab("preview");
            }
          } catch {}
        }
      }),
    [conversationId],
  );
  const read = async (p: string, startLine = 1) => {
    const request = ++generation.current;
    setError("");
    try {
      const data = await window.schoolwork.inspectProject({
        conversationId,
        tool: "read_file",
        args: { path: p, startLine },
      });
      if (request === generation.current) setFile(data);
    } catch (e) {
      if (request === generation.current) setError(String(e));
    }
  };
  const showPreview = () => {
    try {
      const parsed = new URL(url);
      if (
        !["http:", "https:"].includes(parsed.protocol) ||
        !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
      )
        throw new Error(
          t(
            "Use a localhost preview URL.",
            "Använd en lokal localhost-adress.",
          ),
        );
      setPreview(parsed.href);
      setError("");
    } catch (e) {
      setError(String(e));
    }
  };
  return (
    <>
      <div
        className="work-tabs"
        role="tablist"
        aria-label={t("Work panel", "Arbetspanel")}
      >
        {[
          ["files", t("Files", "Filer")],
          ["preview", t("Preview", "Webbvy")],
          ["desktop", t("Desktop", "Skärm")],
          ["activity", t("Activity", "Aktivitet")],
        ].map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => {
              setTab(key);
              setError("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="work-panel-content" role="tabpanel">
        {error && (
          <p className="panel-error" role="alert">
            {error}
          </p>
        )}
        {tab === "activity" && (
          <ActivityLog conversationId={conversationId} swedish={swedish} />
        )}
        {tab === "desktop" && (
          <DesktopPanel
            conversationId={conversationId}
            swedish={swedish}
            capabilities={capabilities}
            onCapture={onCapture}
            onStop={onStop}
          />
        )}
        {tab === "files" && (
          <>
            <form
              className="file-search"
              onSubmit={(e) => {
                e.preventDefault();
                setFile(null);
                void load();
              }}
            >
              <Search size={16} />
              <input
                aria-label={t("Find files", "Hitta filer")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Find a file…", "Hitta en fil…")}
              />
              <button disabled={busy}>{t("Find", "Sök")}</button>
            </form>
            <div className="file-location">
              <button
                className="icon"
                aria-label={t("Parent folder", "Överordnad mapp")}
                onClick={() => {
                  setFile(null);
                  setQuery("");
                  void load(directory + "/..", 0, "");
                }}
              >
                <ArrowUp size={15} />
              </button>
              <span title={directory}>{directory}</span>
              <button
                className="icon"
                aria-label={t("Refresh files", "Uppdatera filer")}
                onClick={() => void load()}
              >
                <RefreshCw size={15} />
              </button>
            </div>
            {busy && (
              <p className="panel-hint" role="status">
                {t("Reading files…", "Läser filer…")}
              </p>
            )}
            {!busy && !rows.length && (
              <p className="panel-hint">
                {t("No files found.", "Inga filer hittades.")}
              </p>
            )}
            <div className="file-list">
              {rows.map((row) => (
                <button
                  key={row.path}
                  title={row.path}
                  className={file?.path === row.path ? "selected" : ""}
                  onClick={() => {
                    if (row.type === "directory") {
                      setFile(null);
                      setQuery("");
                      void load(row.path, 0, "");
                    } else void read(row.path);
                  }}
                >
                  {row.type === "directory" ? (
                    <Folder size={16} />
                  ) : (
                    <FileText size={16} />
                  )}
                  <span>{row.name}</span>
                </button>
              ))}
            </div>
            {next !== null && (
              <button
                className="panel-action"
                disabled={busy}
                onClick={() => void load(directory, next)}
              >
                {t("Load more", "Visa fler")}
              </button>
            )}
            {file && (
              <section className="file-reader">
                <header>
                  <strong>{file.path.split(/[\\/]/).pop()}</strong>
                  <button
                    onClick={() => setFile(null)}
                    aria-label={t("Close file", "Stäng fil")}
                  >
                    ×
                  </button>
                </header>
                <small>
                  {t("Lines", "Rader")} {file.startLine}–{file.endLine} /{" "}
                  {file.totalLines}
                </small>
                <pre>{file.text}</pre>
                {file.nextLine && (
                  <button
                    className="panel-action"
                    onClick={() => void read(file.path, file.nextLine)}
                  >
                    {t("Next excerpt", "Nästa utdrag")}
                  </button>
                )}
              </section>
            )}
          </>
        )}
        {tab === "preview" && (
          <>
            <form
              className="preview-address"
              onSubmit={(e) => {
                e.preventDefault();
                showPreview();
              }}
            >
              <Globe size={16} />
              <input
                aria-label={t(
                  "Local preview address",
                  "Lokal förhandsvisningsadress",
                )}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button title={t("Load preview", "Ladda förhandsvisning")}>
                ↵
              </button>
            </form>
            {preview ? (
              <>
                <iframe
                  title={t("Local website preview", "Lokal förhandsvisning")}
                  src={preview}
                  sandbox="allow-scripts allow-forms"
                  referrerPolicy="no-referrer"
                />
                <button
                  className="panel-action"
                  onClick={() => void window.schoolwork.openUrl(preview)}
                >
                  <ExternalLink size={14} />{" "}
                  {t("Open in browser", "Öppna i webbläsaren")}
                </button>
              </>
            ) : (
              <div className="preview-empty">
                <Globe size={32} />
                <h3>{t("Your project, live", "Ditt projekt, live")}</h3>
                <p>
                  {t(
                    "Ask the agent to start a local server, then enter its address above.",
                    "Be agenten starta en lokal server och ange adressen ovan.",
                  )}
                </p>
              </div>
            )}
            <p className="panel-hint">
              {t(
                "Isolated preview. Some sites require opening in your browser. A preview is not an automated test.",
                "Isolerad förhandsvisning. Vissa sidor behöver öppnas i webbläsaren. En förhandsvisning är inte ett automatiskt test.",
              )}
            </p>
          </>
        )}
      </div>
    </>
  );
}
