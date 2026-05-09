import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InvestigatorService } from './investigator.service';
import { SessionService } from '../session/session.service';
import { InvestigationLogService } from './log/investigation-log.service';
import { StartSessionDto } from './dto/start-session.dto';
import { AskQuestionDto } from './dto/ask-question.dto';

@Controller('investigate')
export class InvestigatorController {
  constructor(
    private readonly investigator: InvestigatorService,
    private readonly sessions: SessionService,
    private readonly logService: InvestigationLogService,
  ) {}

  // POST /api/investigate/sessions
  // Paste a GitHub URL → get a sessionId back
  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  startSession(@Body() dto: StartSessionDto) {
    return this.investigator.startSession(dto.repoUrl, dto.branch);
  }

  // POST /api/investigate/sessions/:id/ask
  // Ask any question — returns answer + tool call log
  @Post('sessions/:id/ask')
  @HttpCode(HttpStatus.OK)
  ask(@Param('id') id: string, @Body() dto: AskQuestionDto) {
    return this.investigator.ask(id, dto.question);
  }

  // GET /api/investigate/sessions/:id
  // View session state: turnCount, seenFiles, full Q&A history
  @Get('sessions/:id')
  getSession(@Param('id') id: string) {
    return this.sessions.snapshot(id);
  }

  // GET /api/investigate/sessions
  // List all active sessions
  @Get('sessions')
  listSessions() {
    return this.sessions.list().map((s) => ({
      ...s,
      seenFiles: [...s.seenFiles],
    }));
  }

  // GET /api/investigate/sessions/:id/log
  // Full investigation log: turns, established facts, contradictions
  @Get('sessions/:id/log')
  getLog(@Param('id') id: string) {
    const session = this.sessions.get(id);
    return this.logService.getLogSnapshot(session);
  }

  // DELETE /api/investigate/sessions/:id
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSession(@Param('id') id: string) {
    this.sessions.delete(id);
  }
}
