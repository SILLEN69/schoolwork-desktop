import type { SchoolWorkStore } from "./storage";

type Lesson = {
  app: string;
  tool: string;
  failure: string;
  recovery: string[];
  environment: string;
  evidenceTask: string;
  updatedAt: number;
  successes: number;
};
/** Learns recorded primitive recoveries, not model-written instructions or unverified task success. */
export class DesktopLearning {
  private pending = new Map<
    string,
    {
      app: string;
      tool: string;
      failure: string;
      recovery: string[];
      succeeded: boolean;
      environment: string;
    }
  >();
  private environments = new Map<string, string>();
  private apps = new Map<string, string>();
  constructor(
    private store: Pick<SchoolWorkStore, "getMetadata" | "setMetadata">,
  ) {}
  list(): Lesson[] {
    try {
      return JSON.parse(this.store.getMetadata("desktop_lessons_v1") || "[]");
    } catch {
      return [];
    }
  }
  forget() {
    this.store.setMetadata("desktop_lessons_v1", "[]");
    this.pending.clear();
  }
  finish(owner: string) {
    this.pending.delete(owner);
    this.environments.delete(owner);
    this.apps.delete(owner);
  }
  observe(owner: string, tool: string, outcome: any) {
    if (tool === "list_displays" && outcome.ok)
      this.environments.set(owner, JSON.stringify(outcome.data));
    const app = outcome.data?.window?.appId;
    if (app) this.apps.set(owner, app.toLowerCase());
    if (
      ![
        "focus_window",
        "move_window",
        "capture_screen",
        "inspect_window",
        "click",
        "type_text",
        "key_press",
        "scroll",
      ].includes(tool)
    )
      return;
    const currentApp = this.apps.get(owner);
    if (!outcome.ok) {
      // Store only known operational error classes, never input text, window titles or captured content.
      const failure = /focus/i.test(outcome.summary)
        ? "focus lost or refused"
        : /expired|moved|resiz|identity/i.test(outcome.summary)
          ? "observation stale"
          : /monitor|display/i.test(outcome.summary)
            ? "display unavailable"
            : "operation failed; inspect the task journal";
      this.pending.set(owner, {
        app: currentApp || "",
        tool,
        failure,
        recovery: [],
        succeeded: false,
        environment: this.environments.get(owner) || "unknown",
      });
      return;
    }
    const pending = this.pending.get(owner);
    if (!pending || !currentApp || currentApp !== pending.app) return;
    pending.recovery.push(tool);
    pending.recovery = pending.recovery.slice(-12);
    if (tool === pending.tool) pending.succeeded = true;
    if (
      !pending.succeeded ||
      !["capture_screen", "inspect_window"].includes(tool)
    )
      return;
    const all = this.list();
    const existing = all.find(
      (l) =>
        l.app === pending.app &&
        l.tool === pending.tool &&
        l.failure === pending.failure &&
        l.environment === pending.environment,
    );
    const lesson: Lesson = {
      ...pending,
      evidenceTask: owner,
      updatedAt: Date.now(),
      successes: (existing?.successes || 0) + 1,
    };
    this.store.setMetadata(
      "desktop_lessons_v1",
      JSON.stringify(
        [lesson, ...all.filter((l) => l !== existing)].slice(0, 100),
      ),
    );
    this.pending.delete(owner);
  }
}
