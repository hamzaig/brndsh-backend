export interface ToolCallLog {
    toolName: string;
    input: Record<string, any>;
    outputPreview: string;
}
export interface InvestigatorResponse {
    sessionId: string;
    turnNumber: number;
    answer: string;
    toolCallLog: ToolCallLog[];
    audit: any;
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
