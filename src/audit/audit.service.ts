import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { GithubService } from '../github/github.service';
import { AuditResult } from './interfaces/audit.interfaces';
import { ParsedCitation, parseCitations } from '../common/utils/citation.utils';

// ── Auditor system prompt ─────────────────────────────────────────────────────
// Deliberately written in a different voice and framing than the investigator.
// This call has NO repo context, NO session history, NO tool access.
// It only knows: (1) the agent's answer, (2) the raw code at each cited location.
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

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly config: ConfigService,
    private readonly github: GithubService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.getOrThrow<string>('ANTHROPIC_API_KEY'),
    });
  }

  // Thin wrapper — delegates to shared utility; kept for backward-compat
  parseCitations(answer: string): ParsedCitation[] {
    return parseCitations(answer);
  }

  // Fetch actual code for every parsed citation from GitHub
  private async fetchCitedCode(
    owner: string,
    repo: string,
    branch: string,
    citations: ParsedCitation[],
  ): Promise<Map<string, { code: string; exists: boolean }>> {
    const results = new Map<string, { code: string; exists: boolean }>();

    await Promise.all(
      citations.map(async (c) => {
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
        } catch {
          results.set(c.key, {
            code: `[File not found: ${c.filepath}]`,
            exists: false,
          });
        }
      }),
    );

    return results;
  }

  // ── Call B ────────────────────────────────────────────────────────────────
  // Completely isolated from the investigator. No session context, no tools,
  // no shared message history. Receives: answer text + raw cited code blocks.
  async audit(
    answer: string,
    owner: string,
    repo: string,
    branch: string,
  ): Promise<AuditResult> {
    const citations = this.parseCitations(answer);
    this.logger.log(`Auditing answer — ${citations.length} citation(s) found`);

    // Fetch all cited code in parallel before making the Claude call
    const citedCodeMap = await this.fetchCitedCode(owner, repo, branch, citations);

    // Build the evidence section: each citation + actual code side by side
    const evidenceSection =
      citations.length > 0
        ? citations
            .map((c) => {
              const result = citedCodeMap.get(c.key)!;
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

    // ── Fresh Anthropic call — zero shared state with investigator ───────────
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: AUDITOR_SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
    });

    const rawText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    // Parse JSON — strip markdown fences if present
    let parsed: any;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    } catch {
      this.logger.error('Audit response was not valid JSON:\n' + rawText);
      // Fail-safe: return a DOUBT verdict so the human knows something went wrong
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
}
