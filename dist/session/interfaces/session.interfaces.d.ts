import Anthropic from '@anthropic-ai/sdk';
import { RepoTree } from '../../github/interfaces/github.interfaces';
import { InvestigationLog } from '../../investigator/log/investigation-log.interfaces';
export interface Session {
    id: string;
    owner: string;
    repo: string;
    branch: string;
    messages: Anthropic.MessageParam[];
    seenFiles: Set<string>;
    repoTree?: RepoTree;
    log: InvestigationLog;
    compressedSummary?: string;
    turnCount: number;
    createdAt: Date;
    lastActiveAt: Date;
}
export interface CreateSessionDto {
    owner: string;
    repo: string;
    branch: string;
    repoTree?: RepoTree;
}
