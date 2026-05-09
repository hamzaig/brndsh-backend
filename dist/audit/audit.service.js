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
var AuditService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const github_service_1 = require("../github/github.service");
const citation_utils_1 = require("../common/utils/citation.utils");
const AUDITOR_SYSTEM = `You are a skeptical code review auditor. You receive two things:
1. An AI agent's answer about a codebase
2. The actual source code at every file/line the agent cited

You have never seen this repo before. You do not trust the agent's characterisation of the code.
You read the raw code yourself and decide whether the agent's claims hold up.

## YOUR TASKS

### CITATION CHECK
For every citation in the format [filepath:L10-L25]:
- Does that exact file and line range exist in the provided code? (exists: true/false)
- Does the code at those lines actually support what the agent claimed? (supports_claim: true/false)

### LOGIC CHECK
Read the agent's reasoning chain. Does each conclusion follow from the cited evidence?
Flag any logical leap, assumption not backed by code, or "trust me" claim.

### HALLUCINATION CHECK
Did the agent make any claims about the code that have no citation at all?
These are the most dangerous — mark them as flags.

### RISK CHECK
If the agent suggests a fix or change: look at the cited code.
Would applying that change break anything visible in the surrounding code?
Consider: type signatures, callers, contracts, null safety, side effects.

## OUTPUT
Respond with ONLY valid JSON. No explanation outside the JSON block.

{
  "citation_checks": [
    {
      "citation": "filepath:L10-L25",
      "exists": true,
      "supports_claim": true,
      "note": "optional — only include if something is off"
    }
  ],
  "citation_valid": true,
  "reasoning_sound": true,
  "risk_level": "LOW",
  "confidence": "HIGH",
  "flags": [],
  "verdict": "TRUST"
}

Verdict rules:
- TRUST  → citations accurate, reasoning solid, no hallucinations, risk LOW
- VERIFY → minor issues, some unsupported claims, MEDIUM risk
- DOUBT  → citations wrong, major logical gaps, hallucinations detected, or HIGH risk fix`;
let AuditService = AuditService_1 = class AuditService {
    config;
    github;
    logger = new common_1.Logger(AuditService_1.name);
    anthropic;
    constructor(config, github) {
        this.config = config;
        this.github = github;
        this.anthropic = new sdk_1.default({
            apiKey: this.config.getOrThrow('ANTHROPIC_API_KEY'),
        });
    }
    parseCitations(answer) {
        return (0, citation_utils_1.parseCitations)(answer);
    }
    async fetchCitedCode(owner, repo, branch, citations) {
        const results = new Map();
        await Promise.all(citations.map(async (c) => {
            try {
                const content = await this.github.fetchFile(owner, repo, c.filepath, branch);
                const totalLines = this.github.getLineCount(content);
                if (c.startLine > totalLines) {
                    results.set(c.key, {
                        code: `[Line ${c.startLine} does not exist — file only has ${totalLines} lines]`,
                        exists: false,
                    });
                    return;
                }
                const range = this.github.getFileRange(content, c.startLine, c.endLine);
                const numbered = range
                    .split('\n')
                    .map((line, i) => `${String(c.startLine + i).padStart(5)} | ${line}`)
                    .join('\n');
                results.set(c.key, { code: numbered, exists: true });
            }
            catch {
                results.set(c.key, {
                    code: `[File not found: ${c.filepath}]`,
                    exists: false,
                });
            }
        }));
        return results;
    }
    async audit(answer, owner, repo, branch) {
        const citations = this.parseCitations(answer);
        this.logger.log(`Auditing answer — ${citations.length} citation(s) found`);
        const citedCodeMap = await this.fetchCitedCode(owner, repo, branch, citations);
        const evidenceSection = citations.length > 0
            ? citations
                .map((c) => {
                const result = citedCodeMap.get(c.key);
                return [
                    `### Citation: \`${c.key}\``,
                    `File exists: ${result.exists}`,
                    '```',
                    result.code,
                    '```',
                ].join('\n');
            })
                .join('\n\n')
            : '⚠ No citations found in the agent answer. The agent made claims with zero cited evidence.';
        const userMessage = [
            '## Agent Answer (to audit):',
            '',
            answer,
            '',
            '## Actual Source Code at Each Cited Location:',
            '',
            evidenceSection,
        ].join('\n');
        const response = await this.anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 2048,
            system: AUDITOR_SYSTEM,
            messages: [{ role: 'user', content: userMessage }],
        });
        const rawText = response.content
            .filter((b) => b.type === 'text')
            .map((b) => b.text)
            .join('');
        let parsed;
        try {
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
        }
        catch {
            this.logger.error('Audit response was not valid JSON:\n' + rawText);
            parsed = {
                citation_checks: [],
                citation_valid: false,
                reasoning_sound: false,
                risk_level: 'HIGH',
                confidence: 'LOW',
                flags: ['Audit system could not parse auditor response — treat answer with caution'],
                verdict: 'DOUBT',
            };
        }
        return {
            ...parsed,
            citationsFound: citations.length,
            auditedAt: new Date(),
        };
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = AuditService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        github_service_1.GithubService])
], AuditService);
//# sourceMappingURL=audit.service.js.map