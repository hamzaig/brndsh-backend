"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var InvestigationLogService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvestigationLogService = void 0;
const common_1 = require("@nestjs/common");
const citation_utils_1 = require("../../common/utils/citation.utils");
const COMPRESSION_THRESHOLD = 60;
const KEEP_LIVE_TURNS = 5;
let InvestigationLogService = InvestigationLogService_1 = class InvestigationLogService {
    logger = new common_1.Logger(InvestigationLogService_1.name);
    createLog() {
        return {
            turns: [],
            establishedFacts: [],
            contradictions: [],
            openQuestions: [],
        };
    }
    recordTurn(session, data) {
        const { turnNumber, question, answer, toolCallLog, auditResult } = data;
        const filesAccessed = toolCallLog
            .filter((t) => ['fetch_file', 'get_file_range'].includes(t.toolName))
            .map((t) => t.input.path)
            .filter(Boolean);
        const toolsUsed = [...new Set(toolCallLog.map((t) => t.toolName))];
        const record = {
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
        if (auditResult?.verdict === 'TRUST') {
            this.extractAndStoreFacts(session, answer, turnNumber);
        }
        this.detectContradictions(session, answer, turnNumber);
        this.extractOpenQuestions(session, answer);
        this.compressIfNeeded(session);
    }
    extractAndStoreFacts(session, answer, turnNumber) {
        const citations = (0, citation_utils_1.parseCitations)(answer);
        let added = 0;
        for (const c of citations) {
            if (session.log.establishedFacts.some((f) => f.citation === c.key))
                continue;
            const claim = (0, citation_utils_1.extractSentenceAround)(answer, c.raw);
            if (!claim)
                continue;
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
    extractOpenQuestions(session, answer) {
        const markers = /(?:open question|unclear|unresolved|worth checking|TODO|need to verify|not sure)[:\s]+([^.\n]{10,200})/gi;
        let match;
        while ((match = markers.exec(answer)) !== null) {
            const q = match[1].trim();
            if (!session.log.openQuestions.includes(q)) {
                session.log.openQuestions.push(q);
            }
        }
    }
    detectContradictions(session, answer, turnNumber) {
        if (session.log.establishedFacts.length === 0)
            return;
        if (session.log.turns.length <= 1)
            return;
        const newCitations = (0, citation_utils_1.parseCitations)(answer);
        for (const newCit of newCitations) {
            const exactMatch = session.log.establishedFacts.find((f) => f.citation === newCit.key);
            if (!exactMatch)
                continue;
            const newClaim = (0, citation_utils_1.extractSentenceAround)(answer, newCit.raw);
            if (!newClaim || newClaim === exactMatch.claim)
                continue;
            const contradiction = {
                detectedInTurn: turnNumber,
                citation: newCit.key,
                previousFact: exactMatch.claim,
                newClaim,
                description: `Claim about \`${newCit.key}\` changed from turn ${exactMatch.confirmedInTurn}`,
            };
            const alreadyLogged = session.log.contradictions.some((c) => c.citation === newCit.key && c.detectedInTurn === turnNumber);
            if (!alreadyLogged) {
                session.log.contradictions.push(contradiction);
                this.logger.warn(`Contradiction detected at ${newCit.key} (turn ${turnNumber})`);
            }
        }
    }
    compressIfNeeded(session) {
        if (session.messages.length <= COMPRESSION_THRESHOLD)
            return;
        const totalTurns = session.log.turns.length;
        const turnsToCompress = Math.max(0, totalTurns - KEEP_LIVE_TURNS);
        if (turnsToCompress === 0)
            return;
        const compressedTurns = session.log.turns.slice(0, turnsToCompress);
        session.compressedSummary = this.buildCompressionSummary(session, compressedTurns);
        const keepCount = Math.min(KEEP_LIVE_TURNS * 8, session.messages.length);
        session.messages = session.messages.slice(-keepCount);
        this.logger.log(`Compressed ${turnsToCompress} turn(s) into summary. Messages trimmed to ${session.messages.length}.`);
    }
    buildCompressionSummary(session, turns) {
        if (turns.length === 0)
            return '';
        const lines = [
            `## Prior investigation (turns ${turns[0].turnNumber}–${turns[turns.length - 1].turnNumber}, compressed)`,
            '',
            '### Questions covered:',
        ];
        for (const t of turns) {
            lines.push(`- Turn ${t.turnNumber}: "${t.question}" → audit: ${t.auditVerdict ?? 'n/a'}`);
        }
        const relevantFacts = session.log.establishedFacts.filter((f) => f.confirmedInTurn <= turns[turns.length - 1].turnNumber);
        if (relevantFacts.length > 0) {
            lines.push('\n### Established facts from this block:');
            for (const f of relevantFacts) {
                lines.push(`- [\`${f.citation}\`] ${f.claim.substring(0, 150)}`);
            }
        }
        const relevantContradictions = session.log.contradictions.filter((c) => c.detectedInTurn <= turns[turns.length - 1].turnNumber);
        if (relevantContradictions.length > 0) {
            lines.push('\n### Contradictions detected:');
            for (const c of relevantContradictions) {
                lines.push(`- Turn ${c.detectedInTurn}: ${c.description}`);
            }
        }
        return lines.join('\n');
    }
    buildContextSummary(session) {
        const parts = [];
        if (session.compressedSummary) {
            parts.push(session.compressedSummary);
        }
        const { establishedFacts, contradictions, turns } = session.log;
        if (establishedFacts.length > 0) {
            parts.push('\n## Established facts (audit-confirmed this session):');
            parts.push('These are TRUE. Do not contradict them unless you have new evidence. If you do, explicitly say you are correcting turn N.');
            for (const f of establishedFacts) {
                parts.push(`- [\`${f.citation}\`] ${f.claim} (turn ${f.confirmedInTurn})`);
            }
        }
        if (contradictions.length > 0) {
            parts.push('\n## ⚠ Contradictions detected this session:');
            for (const c of contradictions) {
                parts.push(`- Turn ${c.detectedInTurn} | \`${c.citation}\`:`);
                parts.push(`  Was: "${c.previousFact.substring(0, 120)}"`);
                parts.push(`  Now: "${c.newClaim.substring(0, 120)}"`);
            }
            parts.push('Resolve these explicitly if the topic comes up again.');
        }
        const recentTurns = turns.slice(-3);
        if (recentTurns.length > 0) {
            parts.push('\n## Recent turns:');
            for (const t of recentTurns) {
                parts.push(`- Turn ${t.turnNumber}: "${t.question.substring(0, 80)}" → ${t.auditVerdict ?? 'pending'}`);
            }
        }
        return parts.join('\n');
    }
    getLogSnapshot(session) {
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
};
exports.InvestigationLogService = InvestigationLogService;
exports.InvestigationLogService = InvestigationLogService = InvestigationLogService_1 = __decorate([
    (0, common_1.Injectable)()
], InvestigationLogService);
//# sourceMappingURL=investigation-log.service.js.map