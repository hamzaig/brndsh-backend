import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { GithubService } from '../github/github.service';
import { SessionService } from '../session/session.service';
import { AuditService } from '../audit/audit.service';
import { InvestigationLogService } from './log/investigation-log.service';
import { Session } from '../session/interfaces/session.interfaces';
import { INVESTIGATOR_TOOLS, ToolName } from './tools/investigator.tools';
import {
  InvestigatorResponse,
  StartSessionResponse,
  ToolCallLog,
} from './interfaces/investigator.interfaces';

// Static rules block — never changes within a session so Anthropic caches it (5 min TTL)
const STATIC_RULES = `You are an expert codebase investigator. Your job: investigate repositories and answer questions grounded in actual code.

## MANDATORY CITATION RULE
Every factual claim about the code MUST include a citation in this format:
  [\`filepath:L10-L25\`]
Single line: [\`filepath:L42\`]

An uncited claim is an invalid claim. The human reviewer will reject answers without citations.

## INVESTIGATION RULES
1. Never guess — if unsure, use fetch_file or search_code first
2. Use tools actively: list_files to explore, search_code to find patterns, fetch_file for full context, get_file_range to zoom in
3. When suggesting changes, cite exactly what you'd change and explain why the current approach is problematic
4. Flag security issues, dead code, unusual patterns — don't skip the interesting parts
5. If a previous turn established a fact about this repo, stay consistent with it or explicitly correct it with new evidence

## AVAILABLE TOOLS
- fetch_file(path) — full file with line numbers
- list_files(path?) — directory listing
- search_code(query) — full-text search across repo
- get_file_range(path, startLine, endLine) — specific line range (prefer this over re-fetching whole files)

## RESPONSE FORMAT
For non-trivial answers:
1. Direct answer first
2. Evidence with citations for every claim
3. Flag anything risky, unusual, or worth attention
4. Suggestions (if any) grounded in cited code`;

@Injectable()
export class InvestigatorService {
  private readonly logger = new Logger(InvestigatorService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly config: ConfigService,
    private readonly github: GithubService,
    private readonly sessions: SessionService,
    private readonly auditor: AuditService,
    private readonly logService: InvestigationLogService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.getOrThrow<string>('ANTHROPIC_API_KEY'),
    });
  }

  async startSession(repoUrl: string, branchOverride?: string): Promise<StartSessionResponse> {
    const parsed = this.github.parseRepoUrl(repoUrl);
    const branch =
      branchOverride ?? parsed.branch ?? (await this.github.resolveDefaultBranch(parsed.owner, parsed.repo));

    // Pre-fetch top-2-level tree so we can inject it into every system prompt
    const repoTree = await this.github.buildRepoTree({
      owner: parsed.owner,
      repo: parsed.repo,
      branch,
      maxDepth: 2,
    });

    const session = this.sessions.create({
      owner: parsed.owner,
      repo: parsed.repo,
      branch,
      repoTree,
    });

    return {
      sessionId: session.id,
      owner: parsed.owner,
      repo: parsed.repo,
      branch,
      fileCount: repoTree.totalFiles,
      message: `Session ready. ${repoTree.totalFiles} files indexed.`,
    };
  }

  async ask(sessionId: string, question: string): Promise<InvestigatorResponse> {
    const session = this.sessions.get(sessionId);
    const toolCallLog: ToolCallLog[] = [];

    // Add the user's question to the running history
    session.messages.push({ role: 'user', content: question });

    let finalAnswer = '';

    // ── Agentic tool-use loop ──────────────────────────────────────────────
    // Keeps calling Claude until it produces an end_turn (plain text answer).
    // Each tool_use iteration: push assistant blocks → execute tools → push
    // tool_result blocks as a new user turn → call Claude again.
    while (true) {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8096,
        system: this.buildSystemPrompt(session),
        tools: INVESTIGATOR_TOOLS,
        messages: session.messages,
      });

      this.logger.log(
        `Turn ${session.turnCount + 1} | stop_reason=${response.stop_reason} | blocks=${response.content.length}`,
      );

      if (response.stop_reason === 'end_turn') {
        finalAnswer = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('');

        // Commit the final answer to history
        session.messages.push({
          role: 'assistant',
          content: response.content as Anthropic.ContentBlockParam[],
        });
        break;
      }

      if (response.stop_reason === 'tool_use') {
        // Commit the assistant's tool_use blocks to history first
        session.messages.push({
          role: 'assistant',
          content: response.content as Anthropic.ContentBlockParam[],
        });

        // Execute every tool Claude requested and collect results
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;

          const { id, name, input } = block;
          this.logger.log(`  → tool=${name} input=${JSON.stringify(input)}`);

          let output: string;
          try {
            output = await this.executeTool(session, name as ToolName, input as Record<string, any>);
          } catch (err) {
            output = `Tool error: ${(err as Error).message}`;
          }

          toolCallLog.push({
            toolName: name,
            input: input as Record<string, any>,
            outputPreview: output.substring(0, 400),
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: id,
            content: output,
          });
        }

        // Feed all tool results back as the next user turn
        session.messages.push({ role: 'user', content: toolResults });
      }
    }
    // ── End loop ───────────────────────────────────────────────────────────

    session.turnCount++;
    session.lastActiveAt = new Date();

    // ── Call B: Auditor ────────────────────────────────────────────────────
    let audit: any = null;
    try {
      audit = await this.auditor.audit(finalAnswer, session.owner, session.repo, session.branch);
    } catch (err) {
      this.logger.error(`Audit failed: ${(err as Error).message}`);
      audit = {
        verdict: 'VERIFY',
        confidence: 'LOW',
        flags: ['Audit call failed — review answer manually'],
        auditedAt: new Date(),
      };
    }

    // ── Update investigation log ───────────────────────────────────────────
    // Records turn, extracts facts (if TRUST), detects contradictions,
    // and compresses history if messages[] is getting long.
    this.logService.recordTurn(session, {
      turnNumber: session.turnCount,
      question,
      answer: finalAnswer,
      toolCallLog,
      auditResult: audit,
    });

    return {
      sessionId,
      turnNumber: session.turnCount,
      answer: finalAnswer,
      toolCallLog,
      audit,
      log: this.logService.getLogSnapshot(session),
    };
  }

  // ── System prompt builder ─────────────────────────────────────────────────
  // Two blocks:
  //   Block 1 (static) — investigation rules, cached by Anthropic (5 min TTL)
  //   Block 2 (dynamic) — repo identity + seenFiles + tree snapshot, not cached
  //
  // Inspired by Aider base_coder.py: inject file context from history into
  // the system prompt so the model knows what it already "knows" this session.
  // Three-block system prompt:
  //   Block 1 (static) — investigation rules, cached by Anthropic (5 min TTL)
  //   Block 2 (dynamic) — repo identity + tree + seenFiles — not cached
  //   Block 3 (log)     — established facts + contradictions + compressed history
  //
  // Block 3 is the multi-turn coherence mechanism:
  // - Established facts tell the model what's confirmed (don't contradict)
  // - Contradictions alert it to known inconsistencies to resolve
  // - Compressed history is the Aider done_messages equivalent
  private buildSystemPrompt(session: Session): Anthropic.TextBlockParam[] {
    const { owner, repo, branch, seenFiles, repoTree } = session;

    const seenSection =
      seenFiles.size > 0
        ? `\n## Files already fetched this session:\n${[...seenFiles].map((f) => `- ${f}`).join('\n')}\nPrefer get_file_range for these rather than re-fetching.`
        : '';

    const treeLines = repoTree?.files.slice(0, 60).map((f) => `${f.type === 'dir' ? '📁' : '📄'} ${f.path}`) ?? [];
    const treeSection =
      treeLines.length > 0
        ? `\n## Repository top-level structure:\n${treeLines.join('\n')}`
        : '';

    const logContext = this.logService.buildContextSummary(session);

    const blocks: Anthropic.TextBlockParam[] = [
      {
        type: 'text',
        text: STATIC_RULES,
        cache_control: { type: 'ephemeral' },
      },
      {
        type: 'text',
        text: `## Current repository: ${owner}/${repo} (branch: ${branch})${treeSection}${seenSection}`,
      },
    ];

    if (logContext) {
      blocks.push({ type: 'text', text: logContext });
    }

    return blocks;
  }

  // ── Tool router ────────────────────────────────────────────────────────────
  // Executes whatever tool Claude requested and returns a string result.
  // The string goes back into the Anthropic messages array as tool_result content.
  private async executeTool(
    session: Session,
    toolName: ToolName,
    input: Record<string, any>,
  ): Promise<string> {
    const { owner, repo, branch } = session;

    switch (toolName) {
      case 'fetch_file': {
        const content = await this.github.fetchFile(owner, repo, input.path as string, (input.branch as string) ?? branch);
        session.seenFiles.add(input.path as string);

        // Prepend line numbers so Claude can form precise citations
        const numbered = content
          .split('\n')
          .map((line, i) => `${String(i + 1).padStart(5)} | ${line}`)
          .join('\n');

        const lineCount = content.split('\n').length;
        return `File: ${input.path as string} (${lineCount} lines)\n\n${numbered}`;
      }

      case 'list_files': {
        const files = await this.github.listFiles(owner, repo, (input.path as string) ?? '', branch);
        if (files.length === 0) return `No files found at: ${(input.path as string) || '/'}`;

        return files
          .map(
            (f) =>
              `${f.type === 'dir' ? '[DIR] ' : '[FILE]'} ${f.path}${f.size ? `  (${f.size} bytes)` : ''}`,
          )
          .join('\n');
      }

      case 'search_code': {
        const results = await this.github.searchCode(owner, repo, input.query as string, (input.perPage as number) ?? 10);
        if (results.length === 0) return `No results for: "${input.query as string}"`;

        return results
          .map((r) => {
            const snippets =
              r.text_matches?.map((m) => `  > ${m.fragment.trim()}`).join('\n') ?? '';
            return `📄 ${r.path}\n${snippets}`;
          })
          .join('\n\n');
      }

      case 'get_file_range': {
        const content = await this.github.fetchFile(owner, repo, input.path as string, branch);
        const range = this.github.getFileRange(content, input.startLine as number, input.endLine as number);

        const numbered = range
          .split('\n')
          .map((line, i) => `${String((input.startLine as number) + i).padStart(5)} | ${line}`)
          .join('\n');

        return `${input.path as string}:L${input.startLine as number}-L${input.endLine as number}\n\n${numbered}`;
      }

      default:
        return `Unknown tool: ${toolName}`;
    }
  }
}
