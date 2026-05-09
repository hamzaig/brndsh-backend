import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { GithubModule } from '../github/github.module';

@Module({
  imports: [GithubModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
