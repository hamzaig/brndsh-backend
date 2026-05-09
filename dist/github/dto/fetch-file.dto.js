"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FetchFileRangeDto = exports.FetchFileDto = void 0;
class FetchFileDto {
    owner;
    repo;
    path;
    branch;
}
exports.FetchFileDto = FetchFileDto;
class FetchFileRangeDto {
    owner;
    repo;
    path;
    startLine;
    endLine;
    branch;
}
exports.FetchFileRangeDto = FetchFileRangeDto;
//# sourceMappingURL=fetch-file.dto.js.map