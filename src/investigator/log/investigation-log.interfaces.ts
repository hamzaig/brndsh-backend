export interface TurnRecord {
  turnNumber: number;
  question: string;
  answer: string;
  toolsUsed: string[];         // unique tool names called this turn
  filesAccessed: string[];     // file paths touched this turn
  auditVerdict: 'TRUST' | 'VERIFY' | 'DOUBT' | null;
  auditConfidence: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  timestamp: Date;
}

export interface EstablishedFact {
  claim: string;               // sentence containing the citation
  citation: string;            // "filepath:L10-L25"
  confirmedInTurn: number;     // turn where audit said TRUST
}

export interface Contradiction {
  detectedInTurn: number;
  citation: string;            // which citation triggered the conflict
  previousFact: string;        // what was previously established
  newClaim: string;            // what the new answer says
  description: string;
}

export interface InvestigationLog {
  turns: TurnRecord[];
  establishedFacts: EstablishedFact[];
  contradictions: Contradiction[];
  // Questions flagged as unresolved — populated from open_questions in answers
  openQuestions: string[];
}
