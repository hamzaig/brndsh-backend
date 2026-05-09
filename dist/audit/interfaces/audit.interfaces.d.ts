export interface CitationCheck {
    citation: string;
    exists: boolean;
    supports_claim: boolean;
    note?: string;
}
export interface AuditResult {
    citation_checks: CitationCheck[];
    citation_valid: boolean;
    reasoning_sound: boolean;
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
    confidence: 'LOW' | 'MEDIUM' | 'HIGH';
    flags: string[];
    verdict: 'TRUST' | 'VERIFY' | 'DOUBT';
    citationsFound: number;
    auditedAt: Date;
}
