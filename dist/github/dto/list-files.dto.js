"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuildRepoTreeDto = exports.ListFilesDto = void 0;
class ListFilesDto {
    owner;
    repo;
    path;
    branch;
}
exports.ListFilesDto = ListFilesDto;
class BuildRepoTreeDto {
    owner;
    repo;
    branch;
    maxDepth;
    excludeDirs;
}
exports.BuildRepoTreeDto = BuildRepoTreeDto;
//# sourceMappingURL=list-files.dto.js.map