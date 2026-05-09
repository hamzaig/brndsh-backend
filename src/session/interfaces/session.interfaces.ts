import Anthropic from '@anthropic-ai/sdk';
import { RepoTree } from '../../github/interfaces/github.interfaces';
import { InvestigationLog } from '../../investigator/log/investigation-log.interfaces';

export interface Session {
  id: string;
  owner: string;
  repo: string;
  branch: string;
  // Full message history — fed directly to Anthropic messages.create on every turn
  messages: Anthropic.MessageParam[];
  // Paths fetched this session — injected into system prompt so Claude knows its context
  seenFiles: Set<string>;
  // Optional pre-fetched tree (top-2 levels)
  repoTree?: RepoTree;
  // Structured record of every turn, established facts, contradictions
  log: InvestigationLog;
  // Aider done_messages equivalent: compressed summary of old turns
  // Injected into system prompt after messages[] is trimmed
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
