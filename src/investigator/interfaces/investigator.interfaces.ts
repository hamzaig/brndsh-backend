export interface ToolCallLog {
  toolName: string;
  input: Record<string, any>;
  // Truncated output for response payload (full output stays in session messages)
  outputPreview: string;
}

export interface InvestigatorResponse {
  sessionId: string;
  turnNumber: number;
  answer: string;
  toolCallLog: ToolCallLog[];
  // Call B result — from a completely separate Claude call with fresh context
  audit: any;
  // Structured log snapshot: established facts, contradictions, turn history
  log: any;
}

export interface StartSessionResponse {
  sessionId: string;
  owner: string;
  repo: string;
  branch: string;
  fileCount: number;
  message: string;
}
