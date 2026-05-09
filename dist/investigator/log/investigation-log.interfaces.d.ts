export interface TurnRecord {
    turnNumber: number;
    question: string;
    answer: string;
    toolsUsed: string[];
    filesAccessed: string[];
    auditVerdict: 'TRUST' | 'VERIFY' | 'DOUBT' | null;
    auditConfidence: 'LOW' | 'MEDIUM' | 'HIGH' | null;
    timestamp: Date;
}
export interface EstablishedFact {
    claim: string;
    citation: string;
    confirmedInTurn: number;
}
export interface Contradiction {
    detectedInTurn: number;
    citation: string;
    previousFact: string;
    newClaim: string;
    description: string;
}
export interface InvestigationLog {
    turns: TurnRecord[];
    establishedFacts: EstablishedFact[];
    contradictions: Contradiction[];
    openQuestions: string[];
}
