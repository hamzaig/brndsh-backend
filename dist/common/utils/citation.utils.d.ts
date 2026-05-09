export interface ParsedCitation {
    raw: string;
    filepath: string;
    startLine: number;
    endLine: number;
    key: string;
}
export declare function parseCitations(text: string): ParsedCitation[];
export declare function extractSentenceAround(text: string, target: string): string;
