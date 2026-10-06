import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import crypto from "node:crypto";

export class DesktopBridge {
  private child?: ChildProcessWithoutNullStreams;
  private pending = new Map<
    string,
    { resolve: (value: any) => void; reject: (error: Error) => void }
  >();
  private queue: Promise<unknown> = Promise.resolve();
  private generation = 0;
  constructor(private executable: string) {}
  stop(
    reason = "Desktop work stopped. A partially sent input must be inspected before retrying.",
  ) {
    this.generation++;
    const child = this.child;
    this.child = undefined;
    for (const request of this.pending.values())
      request.reject(new Error(reason));
    this.pending.clear();
    child?.kill();
  }
  private start() {
    if (process.platform !== "win32")
      throw new Error("Desktop tools require Windows.");
    if (this.child) return this.child;
    const child = spawn(this.executable, [], {
      windowsHide: true,
      shell: false,
      stdio: "pipe",
    });
    this.child = child;
    createInterface({ input: child.stdout }).on("line", (line) => {
      try {
        if (line.length > 16_000_000)
          throw new Error("Desktop response exceeded its limit.");
        const response = JSON.parse(line);
        const request = this.pending.get(response.id);
        if (!request) return;
        this.pending.delete(response.id);
        if (response.ok) request.resolve(response.data);
        else
          request.reject(new Error(response.error || "Desktop action failed."));
      } catch {
        this.stop("Desktop helper returned an invalid response.");
      }
    });
    child.stderr.resume();
    child.on("error", (error) => {
      if (this.child === child)
        this.stop("Desktop helper could not start: " + error.message);
    });
    child.on("exit", () => {
      if (this.child === child)
        this.stop(
          "Desktop helper exited. Inspect any interrupted action before retrying.",
        );
    });
    return child;
  }
  request(
    action: string,
    args: Record<string, unknown> = {},
    signal = AbortSignal.timeout(15000),
  ): Promise<any> {
    const generation = this.generation;
    const operation = async () => {
      if (generation !== this.generation)
        throw new Error("Queued desktop action was cancelled.");
      signal.throwIfAborted();
      const child = this.start();
      const id = crypto.randomUUID();
      const abort = () =>
        this.stop(
          "Desktop action cancelled. Inspect the application before repeating input.",
        );
      const timer = setTimeout(
        () =>
          this.stop(
            "Desktop action timed out. Inspect the application before repeating input.",
          ),
        15000,
      );
      signal.addEventListener("abort", abort, { once: true });
      try {
        return await new Promise((resolve, reject) => {
          this.pending.set(id, { resolve, reject });
          child.stdin.write(
            JSON.stringify({ ...args, action, id }) + "\n",
            (error) => {
              if (error) this.stop(error.message);
            },
          );
          if (signal.aborted) abort();
        });
      } finally {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
      }
    };
    const result = this.queue.then(operation, operation);
    this.queue = result.catch(() => {});
    return result;
  }
}
