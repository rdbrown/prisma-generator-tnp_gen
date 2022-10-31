import { generatorHandler, GeneratorOptions } from "@prisma/generator-helper";
import { logger } from "@prisma/sdk";
import { parseEnvValue } from "@prisma/internals";
import * as path from "path";
import { GeneratorPathNotExists } from "./error-handler";
import { GENERATOR_NAME } from "./constants";
import { genEnum } from "./helpers/genEnum";
import { writeFileSafely } from "./utils/writeFileSafely";
import { resolveConfig, format, Options } from "prettier";
const { version } = require("../package.json");

export const PrismaNestBaseGeneratorOptions = {
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

export type PrismaNestBaseGeneratorOptionsKeys =
    keyof typeof PrismaNestBaseGeneratorOptions;
export type PrismaNestBaseGeneratorConfig = Partial<
    Record<PrismaNestBaseGeneratorOptionsKeys, any>
>;

export class PrismaNestBaseGenerator {
    static instance: PrismaNestBaseGenerator;

    _options: GeneratorOptions;
    _prettierOptions: Options;
    rootPath: string;
    clientPath: string;

    constructor(options?: GeneratorOptions) {
        if (options) {
            this._options = options;
        }
        const output = parseEnvValue(this._options.generator.output!);
        this._prettierOptions =
            resolveConfig.sync(output, { useCache: false }) ||
            (resolveConfig.sync(process.cwd()) as Options);
    }

    public get options() {
        return this._options;
    }

    public set options(value) {
        this._options = value;
    }

    public get prettierOptions() {
        return this._prettierOptions;
    }

    public set prettierOptions(value) {
        this._prettierOptions = value;
    }

    static getInstance(options?: GeneratorOptions) {
        if (PrismaNestBaseGenerator.instance) {
            return PrismaNestBaseGenerator.instance;
        }
        PrismaNestBaseGenerator.instance = new PrismaNestBaseGenerator(options);
        return PrismaNestBaseGenerator.instance;
    }

    getClientImportPath() {
        if (!this.rootPath || !this.clientPath) {
            throw new GeneratorPathNotExists();
        }
        return path
            .relative(this.rootPath, this.clientPath)
            .replace("node_modules/", "");
    }

    setPrismaClientPath(): void {
        const { otherGenerators, schemaPath } = this.options;

        this.rootPath = schemaPath.replace("/prisma/schema.prisma", "");
        const defaultPath = path.resolve(
            this.rootPath,
            "node_modules/@prisma/client"
        );
        const clientGenerator = otherGenerators.find(
            (g) => g.provider.value === "prisma-client-js"
        );

        this.clientPath = clientGenerator?.output?.value ?? defaultPath;
    }

    run = async (): Promise<void> => {
        const { generator, dmmf } = this.options;
        const output = parseEnvValue(generator.output!);

        // set path to the client
        const config = this.getConfig();
        this.setPrismaClientPath();
    };

    getConfig = (): PrismaNestBaseGeneratorConfig => {
        const config = this.options.generator.config;

        const result: PrismaNestBaseGeneratorConfig = {};
        for (const optionName in PrismaNestBaseGeneratorOptions) {
            //@ts-ignore
            const { defaultValue } = PrismaNestBaseGeneratorOptions[optionName];
            //@ts-ignore
            result[optionName] = defaultValue;

            const value = config[optionName];
            if (value) {
                if (typeof defaultValue === "boolean") {
                    //@ts-ignore
                    result[optionName] = Boolean(value);
                } else if (typeof defaultValue === "number") {
                    //@ts-ignore
                    result[optionName] = parseInt(value);
                } else {
                    //@ts-ignore
                    result[optionName] = value;
                }
            }
        }

        return result;
    };
}
