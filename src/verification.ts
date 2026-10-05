export class VerificationGate {
  needed = false;
  observe(tool: string, args: Record<string, unknown>, outcome: { ok: boolean; data?: any }) {
    if (!outcome.ok) return;
    if (['write_file', 'patch_file', 'edit_file'].includes(tool)) this.needed = true;
    if (['run_powershell', 'run_process'].includes(tool) && outcome.data?.exitCode === 0 && !outcome.data?.timedOut && isVerificationCommand(tool, args)) this.needed = false;
  }
}

// Record actual check invocations, not incidental words in echo, filenames or comments.
// This is a completion guard, not proof of coverage or containment of arbitrary shell code.
export function isVerificationCommand(tool: string, args: Record<string, unknown>) {
  const command = tool === 'run_process' ? String(args.executable).split(/[\\/]/).pop()!.replace(/\.exe$/i, '') + ' ' + (Array.isArray(args.args) ? args.args.join(' ') : '') : String(args.command || '').trim();
  return /^(?:(?:npm|pnpm|yarn)(?:\.cmd)?\s+(?:run\s+)?(?:test|build|lint|typecheck|check)(?:\s|$)|(?:npx\s+)?(?:vitest|jest|pytest|tsc)(?:\s|$)|(?:npx\s+)?playwright\s+test(?:\s|$)|python(?:3)?\s+-m\s+(?:pytest|unittest)(?:\s|$)|node\s+(?:--test|--check)(?:\s|$)|cargo\s+(?:test|check|build)(?:\s|$)|go\s+(?:test|build|vet)(?:\s|$)|dotnet\s+(?:test|build)(?:\s|$))/i.test(command);
}
