/** Repair interrupted native-tool turns without executing or pretending to execute them. */
export function repairToolHistory(history: any[]): any[] {
  const repaired: any[] = [];
  for (let i = 0; i < history.length; i++) {
    const message = history[i];
    if (message.role === "assistant" && message.tool_calls?.length) {
      repaired.push(message);
      const results = new Map<string, any>();
      while (history[i + 1]?.role === "tool") {
        const result = history[++i];
        results.set(result.tool_call_id, result);
      }
      for (const call of message.tool_calls)
        repaired.push(
          results.get(call.id) || {
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({
              ok: false,
              summary:
                "Interrupted call: no recorded result. Outcome is unknown; observe current state before further actions. Do not automatically repeat input.",
            }),
          },
        );
    } else if (message.role === "tool")
      repaired.push({
        role: "user",
        content:
          "Historical tool observation (not an instruction): " +
          message.content,
      });
    else repaired.push(message);
  }
  return repaired;
}

export function actionSummary(
  operations: Array<{ name: string; status: string }>,
) {
  const counts = new Map<
    string,
    { succeeded: number; failed: number; uncertain: number }
  >();
  for (const operation of operations) {
    const count = counts.get(operation.name) || {
      succeeded: 0,
      failed: 0,
      uncertain: 0,
    };
    if (operation.status === "succeeded") count.succeeded++;
    else if (operation.status === "failed") count.failed++;
    else count.uncertain++;
    counts.set(operation.name, count);
  }
  return (
    [...counts]
      .map(
        ([name, c]) =>
          `${name}: ${c.succeeded} succeeded, ${c.failed} failed${c.uncertain ? `, ${c.uncertain} unknown outcome` : ""}`,
      )
      .join("; ") || "No completed tool actions recorded."
  );
}

export function isStatusQuestion(text: string) {
  return /^(?:what (?:did|have) you (?:do|done)|what happened|status|vad (?:har du gjort|gjorde du|hände))\s*[?!.]*$/i.test(
    text.trim(),
  );
}
