import { ConfigService } from '@nestjs/config';
import { GithubService } from '../github/github.service';
import { AuditResult } from './interfaces/audit.interfaces';
import { ParsedCitation } from '../common/utils/citation.utils';
export declare class AuditService {
    private readonly config;
    private readonly github;
    private readonly logger;
    private readonly anthropic;
    constructor(config: ConfigService, github: GithubService);
    parseCitations(answer: string): ParsedCitation[];
    private fetchCitedCode;
    audit(answer: string, owner: string, repo: string, branch: string): Promise<AuditResult>;
}
