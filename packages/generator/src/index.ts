import { generatorHandler, GeneratorOptions } from "@prisma/generator-helper";
import { GENERATOR_NAME, PrismaClassGenerator } from "./constants";
import { PrismaClassGenerator } from "./generator";
import { logger } from "@prisma/sdk";
import { handleGenerateError } from "./error-handler";

const { version } = require("../package.json");

generatorHandler({
    onManifest() {
        logger.info(`${GENERATOR_NAME}:Registered`);
        return {
            version,
            defaultOutput: "../generated/base",
            prettyName: GENERATOR_NAME,
            requiresGenerators: ["prisma-client-js"]
        };
    },
    onGenerate: async (options: GeneratorOptions) => {
        try {
            await PrismaClassGenerator.getInstance(options).run();
        } catch (error) {
            handleGenerateError(error as Error);
            return;
        }
    }
});

logger.log("Handler Registered.");
