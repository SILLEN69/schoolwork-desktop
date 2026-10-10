export function isCodeArtifact(file: unknown) {
  const value = String(file || '').replace(/\\/g, '/');
  const name = value.split('/').pop() || '';
  // Notes, email drafts and ordinary documents are not executable project edits.
  return /\.(?:[cm]?[jt]sx?|html?|css|scss|sass|less|vue|svelte|py|rb|go|rs|cs|cpp|c|h|java|kt|swift|php|sh|ps1|bat|cmd|sql|ipynb)$/i.test(name)
    || /^(?:package(?:-lock)?\.json|tsconfig[^/]*\.json|.*\.csproj|Cargo\.(?:toml|lock)|go\.(?:mod|sum)|requirements[^/]*\.txt|pyproject\.toml|Dockerfile|Makefile|.*config\.[^/]+)$/i.test(name);
}
export class VerificationGate {
  needed = false;
  observe(tool: string, args: Record<string, unknown>, outcome: { ok: boolean; data?: any }) {
    if (!outcome.ok) return;
    if (['write_file', 'patch_file', 'edit_file'].includes(tool) && isCodeArtifact(args.path)) this.needed = true;
    if (tool==='check_preview' && outcome.data?.expectationPassed === true && outcome.data?.consoleErrors?.length === 0) this.needed = false;
    if (['run_powershell', 'run_process'].includes(tool) && outcome.data?.exitCode === 0 && !outcome.data?.timedOut && isVerificationCommand(tool, args)) this.needed = false;
  }
}

// Record actual check invocations, not incidental words in echo, filenames or comments.
// This is a completion guard, not proof of coverage or containment of arbitrary shell code.
export function isVerificationCommand(tool: string, args: Record<string, unknown>) {
  const command = tool === 'run_process' ? String(args.executable).split(/[\\/]/).pop()!.replace(/\.exe$/i, '') + ' ' + (Array.isArray(args.args) ? args.args.join(' ') : '') : String(args.command || '').trim();
  // A purpose label alone is not verification, but a real test script is:
  // today's agent ran node verify-whisper.cjs successfully and the old gate missed it.
  const argv=Array.isArray(args.args)?args.args.map(String):[];
  const node=tool==='run_process' && /(?:^|[\\/])node(?:\.exe)?$/i.test(String(args.executable)) && /^(build|test|lint)$/.test(String(args.purpose));
  const script=node && /\.(?:[cm]?js)$/i.test(argv[0] || '') && /(?:^|[._-])(?:test|verify|check|spec)(?:[._-]|$)/i.test((argv[0] || '').split(/[\\/]/).pop() || '');
  const assertion=node && argv[0]==='-e' && /(?:require\(['"](?:node:)?assert(?:\/strict)?['"]\)|throw\s+new\s+Error\s*\()/.test(argv[1] || '') && !/^\s*console\./.test(argv[1] || '');
  return Boolean(script || assertion) || /^(?:(?:npm|pnpm|yarn)(?:\.cmd)?\s+(?:run\s+)?(?:test|build|lint|typecheck|check)(?:\s|$)|(?:npx\s+)?(?:vitest|jest|pytest|tsc)(?:\s|$)|(?:npx\s+)?playwright\s+test(?:\s|$)|python(?:3)?\s+-m\s+(?:pytest|unittest)(?:\s|$)|node\s+(?:--test|--check)(?:\s|$)|cargo\s+(?:test|check|build)(?:\s|$)|go\s+(?:test|build|vet)(?:\s|$)|dotnet\s+(?:test|build)(?:\s|$))/i.test(command);
}
