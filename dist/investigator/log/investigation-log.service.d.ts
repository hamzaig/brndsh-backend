import { Session } from '../../session/interfaces/session.interfaces';
import { ToolCallLog } from '../interfaces/investigator.interfaces';
import { EstablishedFact, InvestigationLog } from './investigation-log.interfaces';
export declare class InvestigationLogService {
    private readonly logger;
    createLog(): InvestigationLog;
    recordTurn(session: Session, data: {
        turnNumber: number;
        question: string;
        answer: string;
        toolCallLog: ToolCallLog[];
        auditResult: any;
    }): void;
    private extractAndStoreFacts;
    private extractOpenQuestions;
    private detectContradictions;
    compressIfNeeded(session: Session): void;
    private buildCompressionSummary;
    buildContextSummary(session: Session): string;
    getLogSnapshot(session: Session): {
        totalTurns: number;
        establishedFacts: EstablishedFact[];
        contradictions: import("./investigation-log.interfaces").Contradiction[];
        openQuestions: string[];
        turns: {
            turnNumber: number;
            question: string;
            toolsUsed: string[];
            filesAccessed: string[];
            auditVerdict: "TRUST" | "VERIFY" | "DOUBT" | null;
            auditConfidence: "LOW" | "MEDIUM" | "HIGH" | null;
            timestamp: Date;
        }[];
    };
}
