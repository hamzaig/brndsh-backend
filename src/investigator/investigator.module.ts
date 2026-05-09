import { Module } from '@nestjs/common';
import { InvestigatorService } from './investigator.service';
import { InvestigatorController } from './investigator.controller';
import { InvestigationLogService } from './log/investigation-log.service';
import { GithubModule } from '../github/github.module';
import { SessionModule } from '../session/session.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [GithubModule, SessionModule, AuditModule],
  controllers: [InvestigatorController],
  providers: [InvestigatorService, InvestigationLogService],
  exports: [InvestigatorService, InvestigationLogService],
})
export class InvestigatorModule {}
