"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors({
        origin: ['https://brndsh.vercel.app', 'http://localhost:5173'],
        methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    });
    app.setGlobalPrefix('api');
    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    console.log(`Codebase Investigator running on http://localhost:${port}/api`);
}
bootstrap();
//# sourceMappingURL=main.js.map