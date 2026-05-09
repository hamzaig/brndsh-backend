import { InvestigatorService } from './investigator.service';
import { SessionService } from '../session/session.service';
import { InvestigationLogService } from './log/investigation-log.service';
import { StartSessionDto } from './dto/start-session.dto';
import { AskQuestionDto } from './dto/ask-question.dto';
export declare class InvestigatorController {
    private readonly investigator;
    private readonly sessions;
    private readonly logService;
    constructor(investigator: InvestigatorService, sessions: SessionService, logService: InvestigationLogService);
    startSession(dto: StartSessionDto): Promise<import("./interfaces/investigator.interfaces").StartSessionResponse>;
    ask(id: string, dto: AskQuestionDto): Promise<import("./interfaces/investigator.interfaces").InvestigatorResponse>;
    getSession(id: string): {
        id: string;
        owner: string;
        repo: string;
        branch: string;
        turnCount: number;
        seenFiles: string[];
        createdAt: Date;
        lastActiveAt: Date;
        history: {
            role: "user" | "assistant";
            content: string;
        }[];
    };
    listSessions(): {
        seenFiles: string[];
        owner: string;
        repo: string;
        branch: string;
        id: string;
        log: import("./log/investigation-log.interfaces").InvestigationLog;
        repoTree?: import("../github/interfaces/github.interfaces").RepoTree | undefined;
        compressedSummary?: string | undefined;
        turnCount: number;
        createdAt: Date;
        lastActiveAt: Date;
    }[];
    getLog(id: string): {
        totalTurns: number;
        establishedFacts: import("./log/investigation-log.interfaces").EstablishedFact[];
        contradictions: import("./log/investigation-log.interfaces").Contradiction[];
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
    deleteSession(id: string): void;
}
