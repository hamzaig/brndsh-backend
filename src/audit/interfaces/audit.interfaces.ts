// ParsedCitation moved to src/common/utils/citation.utils.ts (shared with log service)

export interface CitationCheck {
  citation: string;
  exists: boolean;
  supports_claim: boolean;
  note?: string;
}

export interface AuditResult {
  citation_checks: CitationCheck[];
  citation_valid: boolean;       // ALL citations exist AND support their claims
  reasoning_sound: boolean;      // logical chain holds
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  flags: string[];               // specific problems found
  verdict: 'TRUST' | 'VERIFY' | 'DOUBT';
  citationsFound: number;
  auditedAt: Date;
}
