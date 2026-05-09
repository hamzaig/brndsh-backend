"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvestigatorModule = void 0;
const common_1 = require("@nestjs/common");
const investigator_service_1 = require("./investigator.service");
const investigator_controller_1 = require("./investigator.controller");
const investigation_log_service_1 = require("./log/investigation-log.service");
const github_module_1 = require("../github/github.module");
const session_module_1 = require("../session/session.module");
const audit_module_1 = require("../audit/audit.module");
let InvestigatorModule = class InvestigatorModule {
};
exports.InvestigatorModule = InvestigatorModule;
exports.InvestigatorModule = InvestigatorModule = __decorate([
    (0, common_1.Module)({
        imports: [github_module_1.GithubModule, session_module_1.SessionModule, audit_module_1.AuditModule],
        controllers: [investigator_controller_1.InvestigatorController],
        providers: [investigator_service_1.InvestigatorService, investigation_log_service_1.InvestigationLogService],
        exports: [investigator_service_1.InvestigatorService, investigation_log_service_1.InvestigationLogService],
    })
], InvestigatorModule);
//# sourceMappingURL=investigator.module.js.map