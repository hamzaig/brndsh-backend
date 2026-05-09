export interface ParsedCitation {
  raw: string;        // full match — e.g. "[`src/auth.ts:L10-L25`]"
  filepath: string;   // "src/auth.ts"
  startLine: number;  // 10
  endLine: number;    // 25
  key: string;        // "src/auth.ts:L10-L25" — canonical dedup key
}

// Extract every [`filepath:L10-L25`] and [`filepath:L42`] from any text.
// Used by both AuditService and InvestigationLogService.
export function parseCitations(text: string): ParsedCitation[] {
  const citations: ParsedCitation[] = [];
  const regex = /\[`([^`\n]+):L(\d+)(?:-L(\d+))?`\]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const filepath = match[1].trim();
    const startLine = parseInt(match[2], 10);
    const endLine = match[3] ? parseInt(match[3], 10) : startLine;
    const key = `${filepath}:L${startLine}${endLine !== startLine ? `-L${endLine}` : ''}`;
    citations.push({ raw: match[0], filepath, startLine, endLine, key });
  }

  const seen = new Set<string>();
  return citations.filter((c) => {
    if (seen.has(c.key)) return false;
    seen.add(c.key);
    return true;
  });
}

// Extract the sentence (up to ~250 chars) that contains a citation.
// Used to derive the "claim" associated with a cited range.
export function extractSentenceAround(text: string, target: string): string {
  const idx = text.indexOf(target);
  if (idx === -1) return '';

  const windowStart = Math.max(0, idx - 300);
  const windowEnd = Math.min(text.length, idx + target.length + 300);
  const window = text.substring(windowStart, windowEnd);

  const relIdx = idx - windowStart;
  const periodBefore = window.lastIndexOf('.', relIdx - 1);
  const periodAfter = window.indexOf('.', relIdx + target.length);

  const start = periodBefore !== -1 ? periodBefore + 1 : 0;
  const end = periodAfter !== -1 ? periodAfter + 1 : window.length;

  return window.substring(start, end).trim().substring(0, 250);
}
