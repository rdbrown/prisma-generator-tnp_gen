import { generatorHandler, GeneratorOptions } from "@prisma/generator-helper";
//import { logger } from "@prisma/sdk";
import { logger, parseEnvValue } from "@prisma/internals";
import * as path from "path";
import { GeneratorPathNotExists } from "./error-handler";
import { GENERATOR_NAME } from "./constants";
import { genEnum } from "./helpers/genEnum";
import { writeFileSafely } from "./utils/writeFileSafely";
import { PrismaConvertor } from "./convertor";
import { resolveConfig, format, Options } from "prettier";
import { FileComponent } from "./components/file.component";
import { ImportComponent } from "./components/import.component";
import { getRelativeTSPath, prettierFormat, writeTSFile } from "./utils";
import { INDEX_TEMPLATE } from "./templates/index.template";
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
    },
    output: {
        desc: "output path",
        defaultValue: "./base"
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

    modelPath: string;

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

    setPrismaModelsPath(): void {
        const { otherGenerators, schemaPath } = this.options;

        this.rootPath = schemaPath.replace("/prisma/schema.prisma", "");
        const defaultPath = path.resolve(this.rootPath, "prisma/base/model");
        const classGenerator = otherGenerators.find(
            (g) => g.provider.value === "prisma-class-generator"
        );
        this.modelPath = classGenerator?.output?.value ?? defaultPath;
    }

    run = async (): Promise<void> => {
        const { generator, dmmf } = this.options;
        const output = parseEnvValue(generator.output!);

        // set path to the client
        const config = this.getConfig();
        this.setPrismaClientPath();
        logger.info(`starting config: ${JSON.stringify(config)}`);

        //set path to models
        this.setPrismaModelsPath();

        const convertor = PrismaConvertor.getInstance();
        convertor.dmmf = dmmf;
        convertor.config = config;

        //get models
        const models = convertor.getModels();
        const files = models.map(
            (modelComponent) => new FileComponent({ modelComponent, output })
        );
        logger.info(`starting run: ${JSON.stringify(files)}`);
        const classToPath = files.reduce((result, fileRow) => {
            const fullPath = path.resolve(
                fileRow.dir as string,
                fileRow.filename as string
            );
            result[fileRow.prismaModel.name] = fullPath;
            return result;
        }, {} as Record<string, string>);

        files.forEach((fileRow) => {
            fileRow.imports = fileRow.imports?.map((importRow) => {
                const pathToReplace = importRow.getReplacePath(classToPath);
                if (pathToReplace !== null) {
                    importRow.from = fileRow.getRelativePath(pathToReplace);
                }
                return importRow;
            });
        });

        files.forEach((fileRow) => {
            fileRow.write(config.dryRun);
        });

        if (config.makeIndexFile) {
            const indexFilePath = path.resolve(output, "index.ts");
            const imports = files.map(
                (fileRow) =>
                    new ImportComponent(
                        getRelativeTSPath(
                            indexFilePath,
                            fileRow.getPath() as string
                        ),
                        fileRow.prismaModel.name
                    )
            );

            const content = INDEX_TEMPLATE.replace(
                "#!{IMPORTS}",
                imports.map((i) => i.echo("_")).join("\r\n")
            )
                .replace(
                    "#!{RE_EXPORT_CLASSES}",
                    files
                        .map((f) => `	${f.prismaModel.reExportPrefixed("_")}`)
                        .join("\r\n")
                )
                .replace(
                    "#!{CLASSES}",
                    files.map((f) => f.prismaModel.name).join(", ")
                );
            const formattedContent = prettierFormat(
                content,
                this.prettierOptions
            );
            writeTSFile(indexFilePath, formattedContent, config.dryRun);
        }
        return;
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
