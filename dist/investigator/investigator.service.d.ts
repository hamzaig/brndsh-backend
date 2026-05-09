import { ConfigService } from '@nestjs/config';
import { GithubService } from '../github/github.service';
import { SessionService } from '../session/session.service';
import { AuditService } from '../audit/audit.service';
import { InvestigationLogService } from './log/investigation-log.service';
import { InvestigatorResponse, StartSessionResponse } from './interfaces/investigator.interfaces';
export declare class InvestigatorService {
    private readonly config;
    private readonly github;
    private readonly sessions;
    private readonly auditor;
    private readonly logService;
    private readonly logger;
    private readonly anthropic;
    constructor(config: ConfigService, github: GithubService, sessions: SessionService, auditor: AuditService, logService: InvestigationLogService);
    startSession(repoUrl: string, branchOverride?: string): Promise<StartSessionResponse>;
    ask(sessionId: string, question: string): Promise<InvestigatorResponse>;
    private buildSystemPrompt;
    private executeTool;
}
