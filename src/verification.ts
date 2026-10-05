export class VerificationGate {
  needed = false;
  observe(tool: string, args: Record<string, unknown>, outcome: { ok: boolean; data?: any }) {
    if (!outcome.ok) return;
    if (['write_file', 'patch_file'].includes(tool) && /\.(?:[cm]?[jt]sx?|py|html?|css|vue|svelte)$/i.test(String(args.path || ''))) this.needed = true;
    if (tool === 'run_powershell' && outcome.data?.exitCode === 0 && !outcome.data?.timedOut && /\b(test|tests|build|lint|typecheck|check|vitest|jest|pytest|playwright)\b/i.test(String(args.command || ''))) this.needed = false;
  }
}
