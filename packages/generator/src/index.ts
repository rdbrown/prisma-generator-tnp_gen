import { generatorHandler, GeneratorOptions } from "@prisma/generator-helper";
import { GENERATOR_NAME } from "./constants";
import { PrismaNestBaseGenerator } from "./generator";
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
            requiresGenerators: ["prisma-client-js", "prisma-class-generator"]
        };
    },
    onGenerate: async (options: GeneratorOptions) => {
        try {
            await PrismaNestBaseGenerator.getInstance(options).run();
        } catch (error) {
            handleGenerateError(error as Error);
            return;
        }
    }
});

logger.info("Handler Registered Done.");
