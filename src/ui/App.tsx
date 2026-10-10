import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Brain,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  Globe,
  History,
  ImagePlus,
  Monitor,
  Mic,
  GraduationCap,
  LoaderCircle,
  MoreHorizontal,
  PanelRightClose,
  Plus,
  Send,
  Settings,
  Shield,
  Square,
  Terminal,
  Workflow,
  X,
} from "lucide-react";
import MemoryView from "./MemoryView";
import ConversationTimeline from "./ConversationTimeline";
import WorkPanel from "./WorkPanel";
import DesktopSettings from "./DesktopSettings";
import TelegramSettings from "./TelegramSettings";
import LessonWorkspace from "./LessonWorkspace";
import { isSpeechModel } from "../speechModels";
import UpdateNotice from './UpdateNotice';
import ImageAttachments, { imageFileData } from "./ImageAttachments";
import type { Attachment } from "../capabilities";
import { rankTeachGPTModels } from "../modelRanking";
type Msg = {
  role: "user" | "assistant" | "tool";
  content: string;
  model?: string;
  attachments?: Attachment[];
};
type Event = {
  type: string;
  text: string;
  model?: string;
  phase?: string;
  turn?: number;
  tool?: string;
};
const formatElapsed = (seconds: number) => {
  const h = Math.floor(seconds / 3600),
    m = Math.floor((seconds % 3600) / 60),
    s = seconds % 60;
  return h
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const defaults = [
  "Qwen3.8-27B",
  "gpt-oss-120b-high",
  "gpt-oss-120b-medium",
  "Meta-Llama-3.3-70B-Instruct-AWQ",
];
export default function App() {
  const [id, setId] = useState(crypto.randomUUID()),
    [messages, setMessages] = useState<Msg[]>([]),
    [draft, setDraft] = useState(""),
    [settings, setSettings] = useState<any>({
      model: defaults[0],
      workspace: "",
      configured: false,
    }),
    [models, setModels] = useState(defaults),
    [chats, setChats] = useState<any[]>([]),
    [loading, setLoading] = useState(false),
    [status, setStatus] = useState<Event | null>(null),
    [error, setError] = useState(""),
    [showSettings, setShowSettings] = useState(false),
    [showMemory, setShowMemory] = useState(false),
    [currentTaskId, setCurrentTaskId] = useState<string | null>(null),
    [keyInput, setKeyInput] = useState(""),
    [showHistory, setShowHistory] = useState(true),
    [rightPanel, setRightPanel] = useState(true),
    [language, setLanguage] = useState<"en" | "sv">("en");
  const [lessonMode, setLessonMode] = useState<"lesson" | "transcription" | null>(null);
  const modelRevision = useRef(0);
  const pendingModel = useRef<string | null>(null);
  const confirmedModel = useRef(defaults[0]);
  const modelSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const [modelSaving, setModelSaving] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [pendingImages, setPendingImages] = useState<Attachment[]>([]);
  const [importing, setImporting] = useState(false);
  const stickToBottom = useRef(true);
  const end = useRef<HTMLDivElement>(null);
  const selectedId = useRef(id);
  const taskRef = useRef<string | null>(null);
  const submitting = useRef(false);
  taskRef.current = currentTaskId;
  selectedId.current = id;
  const isSv = language === "sv";
  const taskStartedAt = useRef<number | null>(null),
    stageStartedAt = useRef(Date.now()),
    stageKey = useRef("");
  const [clockNow, setClockNow] = useState(Date.now());
  const t = (en: string, sv: string) => (isSv ? sv : en);
  const rankedModels = rankTeachGPTModels([...models, settings.model].filter(m => !isSpeechModel(m)));
  const refresh = async () => {
    const revision = modelRevision.current;
    const [s, c] = await Promise.all([
      window.schoolwork.settingsGet(),
      window.schoolwork.listChats(true),
    ]);
    if (revision === modelRevision.current && !pendingModel.current) confirmedModel.current = s.model;
    setSettings((previous: any) => ({ ...s, model: revision !== modelRevision.current || pendingModel.current ? pendingModel.current || previous.model : s.model }));
    setChats(c);
    setLanguage(s.language === "sv" ? "sv" : "en");
  };
  const changeModel = (value: string) => {
    const revision = ++modelRevision.current;
    pendingModel.current = value;
    setSettings((previous: any) => ({ ...previous, model: value }));
    setModelSaving(true);
    modelSaveQueue.current = modelSaveQueue.current.then(async () => {
      try {
        await window.schoolwork.setModel(value);
        confirmedModel.current = value;
        if (revision === modelRevision.current) { pendingModel.current = null; setModelSaving(false); }
      } catch (error: any) {
        if (revision === modelRevision.current) {
          pendingModel.current = null;
          setSettings((previous: any) => ({ ...previous, model: confirmedModel.current }));
          setModelSaving(false);
          setError(t("Could not save model: ", "Kunde inte spara modell: ") + error.message);
        }
      }
    });
  };
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    const off = window.schoolwork.onEvent((e) => {
      if (e.type === "settings-changed") {
        void refresh().catch((error) => setError(error.message));
        return;
      }
      if (
        [
          "queued",
          "answer",
          "error",
          "checkpoint",
          "paused",
          "cancelled",
        ].includes(e.type)
      )
        void window.schoolwork.listChats(true).then(setChats);
      if (e.conversationId !== selectedId.current) return;
      if (e.type === "screenshot") return;
      if (e.type === "queued") {
        taskRef.current = e.taskId;
        setCurrentTaskId(e.taskId);
        setLoading(true);
        if (e.source === "telegram")
          void window.schoolwork
            .getChat(e.conversationId)
            .then((chat) => {
              if (
                selectedId.current === e.conversationId &&
                taskRef.current === e.taskId &&
                chat.task?.state !== "completed"
              )
                setMessages(chat.messages);
            })
            .catch(() => {});
      }
      if (
        taskRef.current &&
        e.taskId !== taskRef.current &&
        !["answer", "checkpoint"].includes(e.type)
      )
        return;
      if (e.type === "checkpoint") {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: e.text, model: e.model },
        ]);
        setLoading(false);
        setStatus(null);
        if (e.state === "waiting_retry") setError(e.text);
        void window.schoolwork.listChats(true).then(setChats);
        return;
      }
      const nextStage =
        e.type === "stream-progress"
          ? `phase:${e.phase || "waiting"}`
          : `${e.type}:${e.turn || e.tool || ""}`;
      if (
        nextStage !== stageKey.current ||
        (e.type !== "stream-progress" && e.type !== "status")
      ) {
        stageKey.current = nextStage;
        stageStartedAt.current = Date.now();
      }
      if (e.type === "error") {
        setError(e.text);
        setLoading(false);
        setStatus(null);
        return;
      }
      setStatus({
        ...e,
        text:
          e.type === "stream-progress"
            ? e.text.replace(/ · \d+s$/, "")
            : e.text,
      });
      if (e.type === "answer") {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: e.text, model: e.model },
        ]);
        setLoading(false);
        setStatus(null);
        window.schoolwork.listChats(true).then(setChats);
      }
      if (e.type === "cancelled" || e.type === "paused") {
        setLoading(false);
        setStatus(null);
      }
    });
    return off;
  }, []);
  // Recover from a missed IPC event or renderer suspension using authoritative saved state.
  useEffect(() => {
    const sync = async () => {
      if (submitting.current) return;
      const selected = selectedId.current;
      const expectedTask = taskRef.current;
      try {
        const full = await window.schoolwork.getChat(selected);
        if (selected !== selectedId.current || !full.task || submitting.current)
          return;
        if (expectedTask !== taskRef.current) return;
        if (["running", "queued"].includes(full.task.state)) {
          taskRef.current = full.task.id;
          setCurrentTaskId(full.task.id);
          setLoading(true);
          return;
        }
        setMessages(
          (full.messages || []).map((m: any) => ({
            role:
              m.role === "user"
                ? "user"
                : m.role === "tool"
                  ? "tool"
                  : "assistant",
            content: m.content,
            model: m.model,
            attachments: m.attachments || [],
          })),
        );
        setCurrentTaskId(full.task.id);
        taskRef.current = full.task.id;
        setLoading(false);
        setStatus(null);
        setError(
          ["waiting_retry", "paused"].includes(full.task.state)
            ? full.task.error || "Progress saved. Ready to resume."
            : "",
        );
      } catch {
        /* Next event or focus can reconcile again; do not erase the draft. */
      }
    };
    const focus = () => {
      void sync();
      void refresh();
    };
    window.addEventListener("focus", focus);
    const timer = loading ? setInterval(() => void sync(), 3000) : undefined;
    return () => {
      window.removeEventListener("focus", focus);
      if (timer) clearInterval(timer);
    };
  }, [loading, id]);
  useEffect(() => {
    if (stickToBottom.current)
      end.current?.scrollIntoView({ behavior: "auto" });
  }, [messages, status]);
  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [loading]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        fresh();
      }
      if (event.key === "Escape") {
        setShowMemory(false);
        setShowSettings(false);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  const fresh = () => {
    setPendingImages([]);
    taskStartedAt.current = null;
    stageKey.current = "";
    const next = crypto.randomUUID();
    setId(next);
    selectedId.current = next;
    setCurrentTaskId(null);
    taskRef.current = null;
    setLoading(false);
    setMessages([]);
    setError("");
    setStatus(null);
  };
  const chooseChat = async (c: any) => {
    setPendingImages([]);
    stickToBottom.current = true;
    setStatus(null);
    setMessages([]);
    setLoading(false);
    setId(c.id);
    selectedId.current = c.id;
    setShowHistory(false);
    setError("");
    try {
      const full = await window.schoolwork.getChat(c.id);
      if (selectedId.current !== c.id) return;
      setPendingImages(full.draftAttachments || []);
      setCurrentTaskId(full.task?.id || null);
      taskRef.current = full.task?.id || null;
      setLoading(["running", "queued"].includes(full.task?.state));
      if (["running", "queued"].includes(full.task?.state))
        setStatus({
          type: "status",
          text: t("Task in progress…", "Uppgiften pågår…"),
        });
      taskStartedAt.current = full.task?.createdAt || null;
      stageStartedAt.current = Date.now();
      stageKey.current = "loaded";
      if (full.task?.state === "paused" || full.task?.state === "waiting_retry")
        setError(full.task.error || "Task is ready to resume.");
      setMessages(
        (full.messages || []).map((m: any) => ({
          role:
            m.role === "user"
              ? "user"
              : m.role === "tool"
                ? "tool"
                : "assistant",
          content: m.content,
          model: m.model,
          attachments: m.attachments || [],
        })),
      );
    } catch (e: any) {
      setError(e.message);
    }
  };
  const submit = async () => {
    const text = draft.trim();
    if ((!text && !pendingImages.length) || loading || importing) return;
    const images = [...pendingImages];
    stickToBottom.current = true;
    const submittedId = id;
    submitting.current = true;
    setDraft("");
    setError("");
    setMessages((m) => [
      ...m,
      { role: "user", content: text, attachments: images },
    ]);
    taskStartedAt.current = Date.now();
    stageStartedAt.current = Date.now();
    stageKey.current = "planning";
    setClockNow(Date.now());
    setLoading(true);
    setStatus({
      type: "status",
      text: t("Planning your task…", "Planerar uppgiften…"),
    });
    try {
      const taskId = await window.schoolwork.send({
        chatId: submittedId,
        userText: text,
        model: settings.model,
        clientRequestId: crypto.randomUUID(),
        attachmentIds: images.map((a) => a.id),
      });
      if (selectedId.current === submittedId) {
        setCurrentTaskId(taskId);
        taskRef.current = taskId;
        setPendingImages([]);
      }
    } catch (e: any) {
      if (selectedId.current !== submittedId) return;
      setDraft(text);
      setMessages((m) => m.slice(0, -1));
      setError(
        String(e.message || e).replace(
          /^Error invoking remote method 'chat:send': Error: /,
          "",
        ),
      );
      setLoading(false);
      setStatus(null);
    } finally {
      submitting.current = false;
    }
  };
  const cancel = async () => {
    await window.schoolwork.cancel(id);
    setLoading(false);
    setStatus(null);
  };
  const addCapture = (attachment: Attachment) => {
    if (attachment.conversationId === selectedId.current)
      setPendingImages((images) => [...images, attachment]);
  };
  const importFiles = async (files: File[]) => {
    if (importing || loading) return;
    setImporting(true);
    const conversationId = id;
    try {
      for (const file of files) {
        const attachment = await window.schoolwork.importImage({
          conversationId,
          name: file.name || "Pasted image.png",
          base64: await imageFileData(file),
        });
        addCapture(attachment);
      }
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  };
  const chooseImages = async () => {
    setImporting(true);
    const conversationId = id;
    try {
      for (const attachment of await window.schoolwork.chooseImages(
        conversationId,
      ))
        addCapture(attachment);
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  };
  const removeImage = async (attachment: Attachment) => {
    try {
      await window.schoolwork.removeImage({
        id: attachment.id,
        conversationId: attachment.conversationId,
      });
      setPendingImages((images) =>
        images.filter((a) => a.id !== attachment.id),
      );
    } catch (e: any) {
      setError(e.message);
    }
  };
  const captureScreen = async () => {
    setImporting(true);
    const conversationId = id;
    try {
      addCapture(await window.schoolwork.captureScreen({ conversationId }));
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  };
  const stopControl = async () => {
    try {
      await window.schoolwork.stopDesktop();
      await refresh();
      setLoading(false);
      setStatus(null);
    } catch (e: any) {
      setError(e.message);
    }
  };
  const loadModels = async () => {
    try {
      const m = await window.schoolwork.listModels();
      setModels(Array.from(new Set(m)));
    } catch (e: any) {
      setError(e.message);
    }
  };
  const saveKey = async () => {
    try {
      await window.schoolwork.setKey(keyInput);
      setKeyInput("");
      await refresh();
      await loadModels();
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  };
  if (lessonMode) return <LessonWorkspace initialMode={lessonMode} summaryModel={settings.model} configured={settings.configured} onBack={() => setLessonMode(null)} />;
  return (
    <div className="shell">
      <aside className={"sidebar " + (sidebarCollapsed ? "collapsed" : "")}>
        <div className="brand">
          <div className="brand-mark">
            <Workflow size={19} />
          </div>
          <span>SchoolWork</span>
          <button
            className="icon subtle mini"
            title={t("Toggle sidebar", "Visa/dölj sidofält")}
            onClick={() => setSidebarCollapsed((v) => !v)}
          >
            <PanelRightClose size={16} />
          </button>
        </div>
        <button className="new-chat" onClick={fresh}>
          <Plus size={16} />
          {t("New task", "Ny uppgift")}
          <span>Ctrl + K</span>
        </button>
        <div className="side-group">
          <div className="side-label">{t("Workspace", "Arbetsyta")}</div>
          <button
            className="nav-item active"
            onClick={() => window.schoolwork.chooseWorkspace().then(refresh)}
          >
            <Folder size={16} />
            <span>{t("My workspace", "Min arbetsyta")}</span>
          </button>
          <button
            className="nav-item"
            onClick={() => setShowHistory((v) => !v)}
          >
            <History size={16} />
            <span>{t("Recent tasks", "Senaste uppgifter")}</span>
            <ChevronRight size={14} className="nav-end" />
          </button>
        </div>
        <button className="nav-item" onClick={() => setLessonMode("lesson")}><GraduationCap size={16}/><span>{t("Follow a lesson", "Följ en lektion")}</span></button>
        <button className="nav-item" onClick={() => setLessonMode("transcription")}><Mic size={16}/><span>{t("Transcription", "Transkribering")}</span></button>
        <button
          className="nav-item memory-nav"
          onClick={() => setShowMemory(true)}
        >
          <Brain size={16} />
          <span>{t("Memory vault", "Minnesvalv")}</span>
        </button>
        {showHistory && (
          <div className="history-list">
            {chats.map((c) => (
              <button
                key={c.id}
                className="history-row"
                onClick={() => chooseChat(c)}
              >
                {c.title || "Untitled task"}
              </button>
            ))}
            {!chats.length && (
              <div className="empty-side">
                {t("Your tasks will appear here", "Dina uppgifter visas här")}
              </div>
            )}
          </div>
        )}
        <div className="side-spacer" />
        <div
          className="workspace-card"
          onClick={() =>
            window.schoolwork.chooseWorkspace().then(async () => {
              await refresh();
            })
          }
        >
          <div className="folder-icon">
            <Folder size={16} />
          </div>
          <div className="workspace-copy">
            <small>{t("WORKING FOLDER", "ARBETSMAPP")}</small>
            <span title={settings.workspace}>
              {settings.workspace?.split(/[\\/]/).slice(-2).join("/") ||
                "Choose folder"}
            </span>
          </div>
          <MoreHorizontal size={16} />
        </div>
        <button className="profile" onClick={() => setShowSettings(true)}>
          <div className="avatar">
            <Settings size={16} />
          </div>
          <div className="profile-copy">
            <strong>{t("Settings", "Inställningar")}</strong>
            <small>{t("Local workspace", "Lokal arbetsyta")}</small>
          </div>
          <Settings size={16} />
        </button>
      </aside>
      <main className="main">
        <UpdateNotice swedish={isSv}/>
        <header className="topbar">
          <div className="breadcrumbs">
            <span>{t("Workspace", "Arbetsyta")}</span>
            <ChevronRight size={14} />
            <strong>
              {messages[0]?.content?.slice(0, 30) ||
                t("New task", "Ny uppgift")}
            </strong>
          </div>
          <div className="top-actions">
            {settings.capabilities?.controlScreen && (
              <button
                className="tool-pill"
                onClick={() => void stopControl()}
                title="Ctrl + Alt + Escape"
              >
                <Square size={13} />
                {t("Stop screen control", "Stoppa skärmkontroll")}
              </button>
            )}
            {!settings.capabilities?.controlScreen && (
              <button className="tool-pill" title={t("Only you can re-enable input after Stop.", "Bara du kan aktivera inmatning efter Stopp.")} onClick={async () => {
                try {await window.schoolwork.setCapabilities({...settings.capabilities,viewScreen:true,controlScreen:true});await refresh();}
                catch(e:any) {setError(e.message);}
              }}>
                <Monitor size={13} />{t("Enable screen control", "Aktivera skärmkontroll")}
              </button>
            )}
            <div className="privacy">
              <span className="green-dot" />
              TeachGPT <span className="privacy-sep">·</span>
              {t("school-hosted", "skolhostad")}
            </div>
            <button className="icon" onClick={() => setRightPanel((v) => !v)}>
              <PanelRightClose size={17} />
            </button>
          </div>
        </header>
        <div
          className={"conversation " + (messages.length ? "has-messages" : "")}
          onScroll={(e) => {
            const el = e.currentTarget;
            stickToBottom.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 90;
          }}
        >
          {!messages.length ? (
            <div className="welcome">
              <div className="welcome-orb">
                <Workflow size={25} />
              </div>
              <div className="eyebrow">
                {t("YOUR WORKSPACE, READY", "DIN ARBETSYTA ÄR REDO")}
              </div>
              <h1>
                {t("What would you like to get done?", "Vad vill du få gjort?")}
              </h1>
              <p>
                {t(
                  "Research a question, build something, or work through files. SchoolWork can plan the steps and carry the task through.",
                  "Undersök en fråga, bygg något eller arbeta med filer. SchoolWork kan planera stegen och utföra uppgiften.",
                )}
              </p>
              <div className="prompt-grid">
                <button
                  onClick={() =>
                    setDraft(
                      t(
                        "Research the latest developments in ",
                        "Undersök de senaste framstegen inom ",
                      ),
                    )
                  }
                >
                  <Globe size={17} />
                  <span>
                    <b>{t("Research a topic", "Undersök ett ämne")}</b>
                    <small>
                      {t(
                        "Find sources and prepare a brief",
                        "Hitta källor och skapa en sammanfattning",
                      )}
                    </small>
                  </span>
                  <ArrowUp size={15} />
                </button>
                <button
                  onClick={() =>
                    setDraft(
                      t(
                        "Inspect this workspace and help me build ",
                        "Undersök arbetsmappen och hjälp mig bygga ",
                      ),
                    )
                  }
                >
                  <Terminal size={17} />
                  <span>
                    <b>{t("Build or debug", "Bygg eller felsök")}</b>
                    <small>
                      {t(
                        "Write code, run it, and fix issues",
                        "Skriv kod, kör och rätta fel",
                      )}
                    </small>
                  </span>
                  <ArrowUp size={15} />
                </button>
                <button
                  onClick={() =>
                    setDraft(
                      t(
                        "Review the files in my workspace and create ",
                        "Granska filerna i arbetsmappen och skapa ",
                      ),
                    )
                  }
                >
                  <FileText size={17} />
                  <span>
                    <b>{t("Work with files", "Arbeta med filer")}</b>
                    <small>
                      {t(
                        "Analyze, transform, and create documents",
                        "Analysera, bearbeta och skapa dokument",
                      )}
                    </small>
                  </span>
                  <ArrowUp size={15} />
                </button>
                <button
                  onClick={() =>
                    setDraft(
                      t(
                        "Create a small website in my workspace for ",
                        "Skapa en liten webbplats i arbetsmappen för ",
                      ),
                    )
                  }
                >
                  <Workflow size={17} />
                  <span>
                    <b>{t("Create a website", "Skapa en webbplats")}</b>
                    <small>
                      {t(
                        "Make a working local preview",
                        "Skapa en fungerande lokal förhandsvisning",
                      )}
                    </small>
                  </span>
                  <ArrowUp size={15} />
                </button>
              </div>
            </div>
          ) : (
            <div className="thread">
              <ConversationTimeline conversationId={id} fallback={messages} swedish={isSv} running={loading} onUpdated={() => {if(stickToBottom.current)end.current?.scrollIntoView({behavior:'auto'});}} />
              {status && (
                <div className="activity">
                  <span className="activity-icon">
                    <LoaderCircle size={15} className="spin" />
                  </span>
                  <div>
                    <strong>
                      {status.type === "tool-start"
                        ? t("Working with a tool", "Använder ett verktyg")
                        : status.type === "tool-result"
                          ? t("Step completed", "Steg klart")
                          : t("Working on your task", "Arbetar med uppgiften")}
                    </strong>
                    <small>
                      {status.type === "stream-progress"
                        ? status.text.replace(/ · \d+s$/, "")
                        : status.text}
                    </small>
                    <div className="activity-timers">
                      <span>
                        {t("Total", "Totalt")}{" "}
                        {formatElapsed(
                          Math.max(
                            0,
                            Math.floor(
                              (clockNow - (taskStartedAt.current || clockNow)) /
                                1000,
                            ),
                          ),
                        )}
                      </span>
                      <span>
                        {t("This stage", "Det här steget")}{" "}
                        {formatElapsed(
                          Math.max(
                            0,
                            Math.floor(
                              (clockNow - stageStartedAt.current) / 1000,
                            ),
                          ),
                        )}
                      </span>
                    </div>
                  </div>
                  {currentTaskId && (
                    <button
                      className="inline-btn"
                      onClick={async () => {
                        await window.schoolwork.control(currentTaskId, "pause");
                        setLoading(false);
                        setStatus(null);
                      }}
                    >
                      {t("Pause", "Pausa")}
                    </button>
                  )}
                </div>
              )}
              {error && (
                <div className="error-box">
                  <div>
                    <b>
                      {t(
                        "This step needs attention",
                        "Det här steget kräver uppmärksamhet",
                      )}
                    </b>
                    <p>{error}</p>
                    <button
                      className="inline-btn"
                      onClick={() => setShowSettings(true)}
                    >
                      {/(HTTP 429|HTTP 503|HTTP 504)/.test(error)
                        ? t("Choose another model", "Välj en annan modell")
                        : t(
                            "Check connection settings",
                            "Kontrollera anslutningen",
                          )}
                    </button>
                    {currentTaskId && (
                      <button
                        className="inline-btn"
                        onClick={async () => {
                          await window.schoolwork.control(
                            currentTaskId,
                            "retry",
                          );
                          stageStartedAt.current = Date.now();
                          stageKey.current = "retry";
                          setLoading(true);
                          setError("");
                          setStatus({
                            type: "status",
                            text: t(
                              "Resuming saved task…",
                              "Återupptar sparad uppgift…",
                            ),
                          });
                        }}
                      >
                        {t("Retry step / resume", "Försök igen / återuppta")}
                      </button>
                    )}
                  </div>
                  <button className="icon" onClick={() => setError("")}>
                    <X size={16} />
                  </button>
                </div>
              )}
              <div ref={end} />
            </div>
          )}
        </div>
        <div className="composer-wrap">
          {error && !messages.length && (
            <div className="panel-error" role="alert">
              {error}
              <button
                className="icon"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div
            className="composer"
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("Files")) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              void importFiles(Array.from(e.dataTransfer.files));
            }}
          >
            <ImageAttachments
              attachments={pendingImages}
              remove={(attachment) => void removeImage(attachment)}
            />
            <textarea
              aria-label={t("Message", "Meddelande")}
              value={draft}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData.files).filter((file) =>
                  file.type.startsWith("image/"),
                );
                if (files.length) {
                  e.preventDefault();
                  void importFiles(files);
                }
              }}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={t(
                "Describe the outcome you want…",
                "Beskriv resultatet du vill ha…",
              )}
              rows={2}
            />
            <div className="composer-bottom">
              <div className="composer-tools">
                <button
                  type="button"
                  className="tool-pill"
                  onClick={async () => {
                    try {
                      const current = await window.schoolwork.taskStatus(id);
                      setStatus({
                        type: "checkpoint-status",
                        text: current.text,
                      });
                    } catch (e: any) {
                      setError(e.message);
                    }
                  }}
                  title={t(
                    "Read saved task status without waiting for AI",
                    "Läs sparad status utan att vänta på AI",
                  )}
                >
                  {t("What happened?", "Vad hände?")}
                </button>
                <button
                  className="tool-pill"
                  disabled={loading || importing}
                  onClick={() => void chooseImages()}
                >
                  <ImagePlus size={14} />
                  {t("Attach image", "Bifoga bild")}
                </button>
                <button
                  className="tool-pill"
                  disabled={
                    loading || importing || !settings.capabilities?.viewScreen
                  }
                  onClick={() => void captureScreen()}
                >
                  <Monitor size={14} />
                  {t("Screenshot", "Skärmbild")}
                </button>
                {importing && (
                  <LoaderCircle
                    size={16}
                    className="spin"
                    aria-label={t("Importing image", "Läser bild")}
                  />
                )}
                <button
                  className="tool-pill"
                  onClick={() =>
                    window.schoolwork.chooseWorkspace().then(refresh)
                  }
                >
                  <Folder size={14} />
                  {t("Workspace", "Arbetsyta")}
                </button>
                <button
                  className="tool-pill"
                  onClick={() => setShowSettings(true)}
                >
                  <Shield size={14} />
                  {settings.fileAccess === "full-user"
                    ? t("Full file access", "Full filåtkomst")
                    : t("Workspace access", "Arbetsmapp")}
                </button>
              </div>
              <div className="send-area">
                <span>
                  {t(
                    "Enter to send · Shift + Enter for a new line",
                    "Enter skickar · Shift + Enter gör ny rad",
                  )}
                </span>
                <button
                  className="send-btn"
                  onClick={loading ? cancel : submit}
                  disabled={
                    importing ||
                    (!loading && !draft.trim() && !pendingImages.length)
                  }
                  title={
                    loading
                      ? t("Cancel task", "Avbryt uppgift")
                      : t("Send task", "Skicka uppgift")
                  }
                >
                  {loading ? <Square size={14} /> : <Send size={15} />}
                </button>
              </div>
            </div>
          </div>
          <div className="footer-note">
            <Shield size={12} />
            {t(
              "Your TeachGPT key stays encrypted on this device.",
              "Din TeachGPT-nyckel krypteras på den här enheten.",
            )}
            <span>·</span>
            <button
              onClick={() => {
                const next = language === "en" ? "sv" : "en";
                setLanguage(next);
                void window.schoolwork.setLanguage(next);
              }}
            >
              {isSv ? "Svenska" : "English"}
            </button>
          </div>
        </div>
      </main>
      {rightPanel && (
        <aside className="right-panel">
          <div className="panel-head">
            <button
              className="model-select"
              onClick={() => setShowSettings(true)}
            >
              <span className="model-logo">✳</span>
              <span>
                <b>{settings.model}</b>
                <small>{modelSaving ? t("Saving selection…", "Sparar val…") : "TeachGPT"}</small>
              </span>
              <ChevronDown size={15} />
            </button>
            <button
              className="icon"
              title={t("Close panel", "Stäng panel")}
              onClick={() => setRightPanel(false)}
            >
              <PanelRightClose size={16} />
            </button>
          </div>
          <WorkPanel
            conversationId={id}
            swedish={isSv}
            workspace={settings.workspace}
            capabilities={settings.capabilities}
            onCapture={addCapture}
            onStop={() => void stopControl()}
          />
          <div className="panel-bottom">
            <Shield size={14} />
            {t("School inference · Local files", "Skolans AI · Lokala filer")}
          </div>
        </aside>
      )}
      {showSettings && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowSettings(false);
          }}
        >
          <section
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("Settings", "Inställningar")}
          >
            <header>
              <div>
                <span className="eyebrow">SCHOOLWORK</span>
                <h2>{t("Settings", "Inställningar")}</h2>
              </div>
              <button className="icon" onClick={() => setShowSettings(false)}>
                <X size={18} />
              </button>
            </header>
            {error && (
              <p role="alert" className="panel-error">
                {error}
              </p>
            )}
            <div className="setting-block">
              <UpdateNotice settings swedish={isSv}/>
            </div>
            <div className="setting-block">
              <label>{t("TeachGPT API key", "TeachGPT API-nyckel")}</label>
              <p>
                {t(
                  "Stored encrypted on this Windows device. It is sent only to TeachGPT.",
                  "Lagrats krypterat på den här Windows-enheten. Skickas endast till TeachGPT.",
                )}
              </p>
              <div className="key-row">
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={
                    settings.configured
                      ? t(
                          "Key is configured · enter a new key to replace",
                          "Nyckel konfigurerad · ange ny för att byta",
                        )
                      : "Paste your TeachGPT API key"
                  }
                />
                <button
                  className="primary-btn"
                  onClick={saveKey}
                  disabled={!keyInput}
                >
                  {t("Save", "Spara")}
                </button>
              </div>
              <div className="key-state">
                <span
                  className={settings.configured ? "green-dot" : "muted-dot"}
                />
                {settings.configured
                  ? t("API key configured", "API-nyckel konfigurerad")
                  : t("API key not configured", "API-nyckel saknas")}
                <button className="inline-btn" onClick={loadModels}>
                  {t("Refresh available models", "Hämta modeller")}
                </button>
              </div>
            </div>
            <div className="setting-block">
              <label>{t("Default model", "Standardmodell")}</label>
              <p>
                {t(
                  "School-hosted models available through your TeachGPT account. Experimental models may be unavailable.",
                  "Skolhostade modeller via ditt TeachGPT-konto. Experimentella modeller kan vara otillgängliga.",
                )}
              </p>
              <select
                value={settings.model}
                aria-label={t("Default model", "Standardmodell")}
                onChange={(e) => changeModel(e.currentTarget.value)}
              >
                {rankedModels.map((entry) => (
                  <option value={entry.model} key={entry.model}>
                    {entry.model} ·{" "}
                    {entry.rank === null
                      ? t("Not ranked", "Ej rankad")
                      : `#${entry.rank} · AA ${entry.index}`}
                    {entry.model.includes("oss") ? " · experimental" : ""}
                  </option>
                ))}
              </select>
              <p className="model-rank-note">
                {t(
                  "TeachGPT models ranked by the Artificial Analysis Intelligence Index where a matching entry exists. Qwen’s 34 is its highest tested reasoning setting; the exact TeachGPT preset may differ. This general index is a guide for complex project work, not a coding-success guarantee.",
                  "TeachGPT-modeller rangordnade efter Artificial Analysis Intelligence Index där en matchning finns. Qwens 34 är högsta testade resonemangsläge; TeachGPT-inställningen kan skilja sig. Indexet är en generell vägledning för större projekt, inte en garanti för kodningsresultat.",
                )}{" "}
                <span>
                  {t(
                    "Source checked 2026-10-05: artificialanalysis.ai/leaderboards/models",
                    "Källa kontrollerad 2026-10-05: artificialanalysis.ai/leaderboards/models",
                  )}
                </span>
              </p>
            </div>
            <DesktopSettings
              capabilities={settings.capabilities}
              model={settings.model}
              profile={settings.visionProfiles?.[settings.model]}
              swedish={isSv}
              refresh={refresh}
            />
            <TelegramSettings swedish={isSv} />
            <div className="setting-block">
              <label>{t("Working folder", "Arbetsmapp")}</label>
              <p>
                {t(
                  "Default folder for new tasks. Commands run with your Windows user permissions, not in a sandbox.",
                  "Standardmapp för nya uppgifter. Kommandon körs med dina Windows-behörigheter, inte i en sandlåda.",
                )}
              </p>
              <select
                aria-label={t("File access", "Filåtkomst")}
                value={settings.fileAccess || "workspace"}
                onChange={async (e) => {
                  try {
                    await window.schoolwork.setFileAccess(
                      e.target.value as "workspace" | "full-user",
                    );
                    await refresh();
                  } catch (e: any) {
                    setError(e.message);
                  }
                }}
              >
                <option value="workspace">
                  {t("Selected workspace only", "Endast vald arbetsmapp")}
                </option>
                <option value="full-user">
                  {t(
                    "Full user access · all accessible folders",
                    "Full användaråtkomst · alla tillgängliga mappar",
                  )}
                </option>
              </select>
              <p>
                {t(
                  "Changes apply to new tasks. Existing tasks keep their original access.",
                  "Ändringar gäller nya uppgifter. Befintliga uppgifter behåller sin ursprungliga åtkomst.",
                )}
              </p>
              <button
                className="folder-choose"
                onClick={() =>
                  window.schoolwork.chooseWorkspace().then(async () => {
                    await refresh();
                  })
                }
              >
                <Folder size={16} />
                <span>{settings.workspace}</span>
                <span className="change-link">{t("Change", "Ändra")}</span>
              </button>
            </div>
            <div className="settings-foot">
              <Shield size={14} />
              {t(
                "SchoolWork is independent software. Your prompts and file excerpts go to TeachGPT for inference.",
                "SchoolWork är fristående programvara. Dina instruktioner och filutdrag skickas till TeachGPT för AI-bearbetning.",
              )}
            </div>
          </section>
        </div>
      )}
      {showMemory && (
        <MemoryView close={() => setShowMemory(false)} language={language} />
      )}
    </div>
  );
}
