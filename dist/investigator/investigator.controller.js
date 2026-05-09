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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvestigatorController = void 0;
const common_1 = require("@nestjs/common");
const investigator_service_1 = require("./investigator.service");
const session_service_1 = require("../session/session.service");
const investigation_log_service_1 = require("./log/investigation-log.service");
const start_session_dto_1 = require("./dto/start-session.dto");
const ask_question_dto_1 = require("./dto/ask-question.dto");
let InvestigatorController = class InvestigatorController {
    investigator;
    sessions;
    logService;
    constructor(investigator, sessions, logService) {
        this.investigator = investigator;
        this.sessions = sessions;
        this.logService = logService;
    }
    startSession(dto) {
        return this.investigator.startSession(dto.repoUrl, dto.branch);
    }
    ask(id, dto) {
        return this.investigator.ask(id, dto.question);
    }
    getSession(id) {
        return this.sessions.snapshot(id);
    }
    listSessions() {
        return this.sessions.list().map((s) => ({
            ...s,
            seenFiles: [...s.seenFiles],
        }));
    }
    getLog(id) {
        const session = this.sessions.get(id);
        return this.logService.getLogSnapshot(session);
    }
    deleteSession(id) {
        this.sessions.delete(id);
    }
};
exports.InvestigatorController = InvestigatorController;
__decorate([
    (0, common_1.Post)('sessions'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [start_session_dto_1.StartSessionDto]),
    __metadata("design:returntype", void 0)
], InvestigatorController.prototype, "startSession", null);
__decorate([
    (0, common_1.Post)('sessions/:id/ask'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ask_question_dto_1.AskQuestionDto]),
    __metadata("design:returntype", void 0)
], InvestigatorController.prototype, "ask", null);
__decorate([
    (0, common_1.Get)('sessions/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InvestigatorController.prototype, "getSession", null);
__decorate([
    (0, common_1.Get)('sessions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InvestigatorController.prototype, "listSessions", null);
__decorate([
    (0, common_1.Get)('sessions/:id/log'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InvestigatorController.prototype, "getLog", null);
__decorate([
    (0, common_1.Delete)('sessions/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InvestigatorController.prototype, "deleteSession", null);
exports.InvestigatorController = InvestigatorController = __decorate([
    (0, common_1.Controller)('investigate'),
    __metadata("design:paramtypes", [investigator_service_1.InvestigatorService,
        session_service_1.SessionService,
        investigation_log_service_1.InvestigationLogService])
], InvestigatorController);
//# sourceMappingURL=investigator.controller.js.map