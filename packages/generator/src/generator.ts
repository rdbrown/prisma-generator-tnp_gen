import { generatorHandler, GeneratorOptions } from "@prisma/generator-helper";
import { logger } from "@prisma/sdk";
import { parseEnvValue } from "@prisma/internals";
import * as path from "path";
import { GeneratorPathNotExists } from "./error-handler";
import { GENERATOR_NAME } from "./constants";
import { genEnum } from "./helpers/genEnum";
import { writeFileSafely } from "./utils/writeFileSafely";

const { version } = require("../package.json");

export const PrismaClassGeneratorOptions = {
    makeIndexFile: {
        desc: "make index file",
        defaultValue: true
    },
    dryRun: {
        desc: "dry run",
        defaultValue: true
    },
    separateRelationFields: {
        desc: "separate relation fields",
        defaultValue: false
    },
    useSwagger: {
        desc: "use swagger decorator",
        defaultValue: true
    }
} as const;

export type PrismaClassGeneratorOptionsKeys =
    keyof typeof PrismaClassGeneratorOptions;
export type PrismaClassGeneratorConfig = Partial<
    Record<PrismaClassGeneratorOptionsKeys, any>
>;

generatorHandler({
    onManifest() {
        logger.info(`${GENERATOR_NAME}:Registered`);
        return {
            version,
            defaultOutput: "../generated",
            prettyName: GENERATOR_NAME
        };
    },
    onGenerate: async (options: GeneratorOptions) => {
        options.dmmf.datamodel.enums.forEach(async (enumInfo) => {
            const tsEnum = genEnum(enumInfo);
            logger.info(`${GENERATOR_NAME}:enumget:${tsEnum}`);

            const writeLocation = path.join(
                options.generator.output?.value!,
                `${enumInfo.name}.ts`
            );
            logger.info(` writing to ${writeLocation}`);
            await writeFileSafely(writeLocation, tsEnum);
        });
    }
});
