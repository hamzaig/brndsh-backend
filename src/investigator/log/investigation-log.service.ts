import { Injectable, Logger } from '@nestjs/common';
import { Session } from '../../session/interfaces/session.interfaces';
import { ToolCallLog } from '../interfaces/investigator.interfaces';
import {
  EstablishedFact,
  InvestigationLog,
  TurnRecord,
} from './investigation-log.interfaces';
import { parseCitations, extractSentenceAround } from '../../common/utils/citation.utils';

// Aider done_messages threshold: compress when messages array exceeds this.
// Rough estimate: 1 turn with tool calls ≈ 6 messages. 10 turns ≈ 60.
const COMPRESSION_THRESHOLD = 60;

// How many recent turns to keep "live" in the messages array after compression
const KEEP_LIVE_TURNS = 5;

@Injectable()
export class InvestigationLogService {
  private readonly logger = new Logger(InvestigationLogService.name);

  // Called once when a session is created
  createLog(): InvestigationLog {
    return {
      turns: [],
      establishedFacts: [],
      contradictions: [],
      openQuestions: [],
    };
  }

  // ── Main entry point — called after every ask() completes ─────────────────
  recordTurn(
    session: Session,
    data: {
      turnNumber: number;
      question: string;
      answer: string;
      toolCallLog: ToolCallLog[];
      auditResult: any;
    },
  ): void {
    const { turnNumber, question, answer, toolCallLog, auditResult } = data;

    const filesAccessed = toolCallLog
      .filter((t) => ['fetch_file', 'get_file_range'].includes(t.toolName))
      .map((t) => t.input.path as string)
      .filter(Boolean);

    const toolsUsed = [...new Set(toolCallLog.map((t) => t.toolName))];

    // 1. Record the turn
    const record: TurnRecord = {
      turnNumber,
      question,
      answer,
      toolsUsed,
      filesAccessed,
      auditVerdict: auditResult?.verdict ?? null,
      auditConfidence: auditResult?.confidence ?? null,
      timestamp: new Date(),
    };
    session.log.turns.push(record);

    // 2. Extract facts only from TRUST turns — auditor said it checks out
    if (auditResult?.verdict === 'TRUST') {
      this.extractAndStoreFacts(session, answer, turnNumber);
    }

    // 3. Contradiction detection — compare new citations against all established facts
    this.detectContradictions(session, answer, turnNumber);

    // 4. Extract open questions flagged in the answer ("open question:", "unclear:", "TODO:")
    this.extractOpenQuestions(session, answer);

    // 5. Aider-style compression: trim messages array when it gets too long
    this.compressIfNeeded(session);
  }

  // ── Fact extraction ────────────────────────────────────────────────────────
  // Only runs on TRUST-audited turns. Stores each cited range + surrounding
  // sentence as an established fact.
  private extractAndStoreFacts(session: Session, answer: string, turnNumber: number): void {
    const citations = parseCitations(answer);
    let added = 0;

    for (const c of citations) {
      // Skip if this exact citation is already established
      if (session.log.establishedFacts.some((f) => f.citation === c.key)) continue;

      const claim = extractSentenceAround(answer, c.raw);
      if (!claim) continue;

      session.log.establishedFacts.push({
        claim,
        citation: c.key,
        confirmedInTurn: turnNumber,
      });
      added++;
    }

    if (added > 0) {
      this.logger.log(`Turn ${turnNumber}: stored ${added} new established fact(s)`);
    }
  }

  // ── Open question extraction ───────────────────────────────────────────────
  // Picks up sentences the investigator flags as unresolved / needing follow-up.
  private extractOpenQuestions(session: Session, answer: string): void {
    const markers = /(?:open question|unclear|unresolved|worth checking|TODO|need to verify|not sure)[:\s]+([^.\n]{10,200})/gi;
    let match: RegExpExecArray | null;
    while ((match = markers.exec(answer)) !== null) {
      const q = match[1].trim();
      if (!session.log.openQuestions.includes(q)) {
        session.log.openQuestions.push(q);
      }
    }
  }

  // ── Contradiction detection ────────────────────────────────────────────────
  // Looks for cases where the new answer cites the same filepath as an
  // established fact but says something different about it.
  //
  // Programmatic check only — semantic contradictions are caught by:
  //   (a) the investigator (which sees established facts in its system prompt)
  //   (b) the auditor (which also receives established facts)
  private detectContradictions(session: Session, answer: string, turnNumber: number): void {
    if (session.log.establishedFacts.length === 0) return;
    if (session.log.turns.length <= 1) return; // nothing to contradict on turn 1

    const newCitations = parseCitations(answer);

    for (const newCit of newCitations) {
      // Established facts about the same exact citation (file + lines)
      const exactMatch = session.log.establishedFacts.find((f) => f.citation === newCit.key);
      if (!exactMatch) continue;

      const newClaim = extractSentenceAround(answer, newCit.raw);
      if (!newClaim || newClaim === exactMatch.claim) continue;

      // Same citation, different claim text — flag it
      const contradiction = {
        detectedInTurn: turnNumber,
        citation: newCit.key,
        previousFact: exactMatch.claim,
        newClaim,
        description: `Claim about \`${newCit.key}\` changed from turn ${exactMatch.confirmedInTurn}`,
      };

      // Avoid duplicate contradiction records
      const alreadyLogged = session.log.contradictions.some(
        (c) => c.citation === newCit.key && c.detectedInTurn === turnNumber,
      );
      if (!alreadyLogged) {
        session.log.contradictions.push(contradiction);
        this.logger.warn(`Contradiction detected at ${newCit.key} (turn ${turnNumber})`);
      }
    }
  }

  // ── History compression ────────────────────────────────────────────────────
  // Aider keeps cur_messages (live) + done_messages (compressed summary).
  // We do the same: when messages[] exceeds threshold, we:
  //   1. Build a text summary from session.log.turns (which we always keep)
  //   2. Store it in session.compressedSummary
  //   3. Trim messages[] to the most recent KEEP_LIVE_TURNS turns worth of messages
  //
  // The summary is injected into the system prompt's dynamic block — so
  // coherence is maintained even after compression.
  compressIfNeeded(session: Session): void {
    if (session.messages.length <= COMPRESSION_THRESHOLD) return;

    const totalTurns = session.log.turns.length;
    const turnsToCompress = Math.max(0, totalTurns - KEEP_LIVE_TURNS);
    if (turnsToCompress === 0) return;

    const compressedTurns = session.log.turns.slice(0, turnsToCompress);
    session.compressedSummary = this.buildCompressionSummary(session, compressedTurns);

    // Trim messages array — keep only the most recent N messages
    // Rough heuristic: each turn with tools ≈ 6 messages. Keep 5 turns.
    const keepCount = Math.min(KEEP_LIVE_TURNS * 8, session.messages.length);
    session.messages = session.messages.slice(-keepCount);

    this.logger.log(
      `Compressed ${turnsToCompress} turn(s) into summary. Messages trimmed to ${session.messages.length}.`,
    );
  }

  private buildCompressionSummary(session: Session, turns: TurnRecord[]): string {
    if (turns.length === 0) return '';

    const lines: string[] = [
      `## Prior investigation (turns ${turns[0].turnNumber}–${turns[turns.length - 1].turnNumber}, compressed)`,
      '',
      '### Questions covered:',
    ];

    for (const t of turns) {
      lines.push(`- Turn ${t.turnNumber}: "${t.question}" → audit: ${t.auditVerdict ?? 'n/a'}`);
    }

    const relevantFacts = session.log.establishedFacts.filter(
      (f) => f.confirmedInTurn <= turns[turns.length - 1].turnNumber,
    );

    if (relevantFacts.length > 0) {
      lines.push('\n### Established facts from this block:');
      for (const f of relevantFacts) {
        lines.push(`- [\`${f.citation}\`] ${f.claim.substring(0, 150)}`);
      }
    }

    const relevantContradictions = session.log.contradictions.filter(
      (c) => c.detectedInTurn <= turns[turns.length - 1].turnNumber,
    );
    if (relevantContradictions.length > 0) {
      lines.push('\n### Contradictions detected:');
      for (const c of relevantContradictions) {
        lines.push(`- Turn ${c.detectedInTurn}: ${c.description}`);
      }
    }

    return lines.join('\n');
  }

  // ── Context summary for system prompt injection ────────────────────────────
  // Returns the string that goes into the investigator's dynamic system block.
  // Tells the model what's already been confirmed and what's contradicted.
  buildContextSummary(session: Session): string {
    const parts: string[] = [];

    // Compressed history block (if any compression has happened)
    if (session.compressedSummary) {
      parts.push(session.compressedSummary);
    }

    const { establishedFacts, contradictions, turns } = session.log;

    // Established facts — the most important coherence signal
    if (establishedFacts.length > 0) {
      parts.push('\n## Established facts (audit-confirmed this session):');
      parts.push('These are TRUE. Do not contradict them unless you have new evidence. If you do, explicitly say you are correcting turn N.');
      for (const f of establishedFacts) {
        parts.push(`- [\`${f.citation}\`] ${f.claim} (turn ${f.confirmedInTurn})`);
      }
    }

    // Contradictions — alert the model to inconsistencies
    if (contradictions.length > 0) {
      parts.push('\n## ⚠ Contradictions detected this session:');
      for (const c of contradictions) {
        parts.push(`- Turn ${c.detectedInTurn} | \`${c.citation}\`:`);
        parts.push(`  Was: "${c.previousFact.substring(0, 120)}"`);
        parts.push(`  Now: "${c.newClaim.substring(0, 120)}"`);
      }
      parts.push('Resolve these explicitly if the topic comes up again.');
    }

    // Recent turn digest (last 3 turns — quick orientation)
    const recentTurns = turns.slice(-3);
    if (recentTurns.length > 0) {
      parts.push('\n## Recent turns:');
      for (const t of recentTurns) {
        parts.push(`- Turn ${t.turnNumber}: "${t.question.substring(0, 80)}" → ${t.auditVerdict ?? 'pending'}`);
      }
    }

    return parts.join('\n');
  }

  // Snapshot for GET /sessions/:id
  getLogSnapshot(session: Session) {
    return {
      totalTurns: session.log.turns.length,
      establishedFacts: session.log.establishedFacts,
      contradictions: session.log.contradictions,
      openQuestions: session.log.openQuestions,
      turns: session.log.turns.map((t) => ({
        turnNumber: t.turnNumber,
        question: t.question,
        toolsUsed: t.toolsUsed,
        filesAccessed: t.filesAccessed,
        auditVerdict: t.auditVerdict,
        auditConfidence: t.auditConfidence,
        timestamp: t.timestamp,
      })),
    };
  }
}
