"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var InvestigatorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvestigatorService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const github_service_1 = require("../github/github.service");
const session_service_1 = require("../session/session.service");
const audit_service_1 = require("../audit/audit.service");
const investigation_log_service_1 = require("./log/investigation-log.service");
const investigator_tools_1 = require("./tools/investigator.tools");
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
let InvestigatorService = InvestigatorService_1 = class InvestigatorService {
    config;
    github;
    sessions;
    auditor;
    logService;
    logger = new common_1.Logger(InvestigatorService_1.name);
    anthropic;
    constructor(config, github, sessions, auditor, logService) {
        this.config = config;
        this.github = github;
        this.sessions = sessions;
        this.auditor = auditor;
        this.logService = logService;
        this.anthropic = new sdk_1.default({
            apiKey: this.config.getOrThrow('ANTHROPIC_API_KEY'),
        });
    }
    async startSession(repoUrl, branchOverride) {
        const parsed = this.github.parseRepoUrl(repoUrl);
        const branch = branchOverride ?? parsed.branch ?? (await this.github.resolveDefaultBranch(parsed.owner, parsed.repo));
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
    async ask(sessionId, question) {
        const session = this.sessions.get(sessionId);
        const toolCallLog = [];
        session.messages.push({ role: 'user', content: question });
        let finalAnswer = '';
        while (true) {
            const response = await this.anthropic.messages.create({
                model: 'claude-sonnet-4-6',
                max_tokens: 8096,
                system: this.buildSystemPrompt(session),
                tools: investigator_tools_1.INVESTIGATOR_TOOLS,
                messages: session.messages,
            });
            this.logger.log(`Turn ${session.turnCount + 1} | stop_reason=${response.stop_reason} | blocks=${response.content.length}`);
            if (response.stop_reason === 'end_turn') {
                finalAnswer = response.content
                    .filter((b) => b.type === 'text')
                    .map((b) => b.text)
                    .join('');
                session.messages.push({
                    role: 'assistant',
                    content: response.content,
                });
                break;
            }
            if (response.stop_reason === 'tool_use') {
                session.messages.push({
                    role: 'assistant',
                    content: response.content,
                });
                const toolResults = [];
                for (const block of response.content) {
                    if (block.type !== 'tool_use')
                        continue;
                    const { id, name, input } = block;
                    this.logger.log(`  → tool=${name} input=${JSON.stringify(input)}`);
                    let output;
                    try {
                        output = await this.executeTool(session, name, input);
                    }
                    catch (err) {
                        output = `Tool error: ${err.message}`;
                    }
                    toolCallLog.push({
                        toolName: name,
                        input: input,
                        outputPreview: output.substring(0, 400),
                    });
                    toolResults.push({
                        type: 'tool_result',
                        tool_use_id: id,
                        content: output,
                    });
                }
                session.messages.push({ role: 'user', content: toolResults });
            }
        }
        session.turnCount++;
        session.lastActiveAt = new Date();
        let audit = null;
        try {
            audit = await this.auditor.audit(finalAnswer, session.owner, session.repo, session.branch);
        }
        catch (err) {
            this.logger.error(`Audit failed: ${err.message}`);
            audit = {
                verdict: 'VERIFY',
                confidence: 'LOW',
                flags: ['Audit call failed — review answer manually'],
                auditedAt: new Date(),
            };
        }
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
    buildSystemPrompt(session) {
        const { owner, repo, branch, seenFiles, repoTree } = session;
        const seenSection = seenFiles.size > 0
            ? `\n## Files already fetched this session:\n${[...seenFiles].map((f) => `- ${f}`).join('\n')}\nPrefer get_file_range for these rather than re-fetching.`
            : '';
        const treeLines = repoTree?.files.slice(0, 60).map((f) => `${f.type === 'dir' ? '📁' : '📄'} ${f.path}`) ?? [];
        const treeSection = treeLines.length > 0
            ? `\n## Repository top-level structure:\n${treeLines.join('\n')}`
            : '';
        const logContext = this.logService.buildContextSummary(session);
        const blocks = [
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
    async executeTool(session, toolName, input) {
        const { owner, repo, branch } = session;
        switch (toolName) {
            case 'fetch_file': {
                const content = await this.github.fetchFile(owner, repo, input.path, input.branch ?? branch);
                session.seenFiles.add(input.path);
                const numbered = content
                    .split('\n')
                    .map((line, i) => `${String(i + 1).padStart(5)} | ${line}`)
                    .join('\n');
                const lineCount = content.split('\n').length;
                return `File: ${input.path} (${lineCount} lines)\n\n${numbered}`;
            }
            case 'list_files': {
                const files = await this.github.listFiles(owner, repo, input.path ?? '', branch);
                if (files.length === 0)
                    return `No files found at: ${input.path || '/'}`;
                return files
                    .map((f) => `${f.type === 'dir' ? '[DIR] ' : '[FILE]'} ${f.path}${f.size ? `  (${f.size} bytes)` : ''}`)
                    .join('\n');
            }
            case 'search_code': {
                const results = await this.github.searchCode(owner, repo, input.query, input.perPage ?? 10);
                if (results.length === 0)
                    return `No results for: "${input.query}"`;
                return results
                    .map((r) => {
                    const snippets = r.text_matches?.map((m) => `  > ${m.fragment.trim()}`).join('\n') ?? '';
                    return `📄 ${r.path}\n${snippets}`;
                })
                    .join('\n\n');
            }
            case 'get_file_range': {
                const content = await this.github.fetchFile(owner, repo, input.path, branch);
                const range = this.github.getFileRange(content, input.startLine, input.endLine);
                const numbered = range
                    .split('\n')
                    .map((line, i) => `${String(input.startLine + i).padStart(5)} | ${line}`)
                    .join('\n');
                return `${input.path}:L${input.startLine}-L${input.endLine}\n\n${numbered}`;
            }
            default:
                return `Unknown tool: ${toolName}`;
        }
    }
};
exports.InvestigatorService = InvestigatorService;
exports.InvestigatorService = InvestigatorService = InvestigatorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        github_service_1.GithubService,
        session_service_1.SessionService,
        audit_service_1.AuditService,
        investigation_log_service_1.InvestigationLogService])
], InvestigatorService);
//# sourceMappingURL=investigator.service.js.map