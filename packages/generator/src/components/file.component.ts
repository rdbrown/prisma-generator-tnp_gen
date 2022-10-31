import { pascalCase, snakeCase } from "change-case";
import { ModelComponent } from "./model.component";
import * as path from "path";
import { getRelativeTSPath, prettierFormat, writeTSFile } from "../utils";
import { PrismaNestBaseGenerator } from "../generator";
import { Echoable } from "../interfaces/echoable";
import { ImportComponent } from "./import.component";

export class FileComponent implements Echoable {
    private _dir?: string;
    private _filename?: string;
    private _imports?: ImportComponent[] = [];
    private _prismaModel: ModelComponent;
    static TEMP_PREFIX = "__TEMPORARY_MODEL_PATH__";

    public get dir() {
        return this._dir;
    }

    public set dir(value) {
        this._dir = value;
    }

    public get filename() {
        return this._filename;
    }

    public set filename(value) {
        this._filename = value;
    }

    public get imports() {
        return this._imports;
    }

    public set imports(value) {
        this._imports = value;
    }

    public get prismaModel() {
        return this._prismaModel;
    }

    public set prismaModel(value) {
        this._prismaModel = value;
    }

    constructor(input: { modelComponent: ModelComponent; output: string }) {
        const { modelComponent, output } = input;
        this._prismaModel = modelComponent;
        this.dir = path.resolve(output);
        this.filename = `${snakeCase(modelComponent.name)}.ts`;
        this.resolveImports();
    }

    echoImports = () => {
        if (this.imports)
            return this.imports
                .reduce((result, importRow) => {
                    result.push(importRow.echo() as never);
                    return result;
                }, [])
                .join("\r\n");
    };

    echo = () => {
        return this.prismaModel
            .echo()
            .replace("#!{IMPORTS}", this.echoImports() as string);
    };

    registerImport(item: string, from: string) {
        const oldIndex =
            this.imports?.findIndex((_import) => _import.from === from) || -1;
        if (oldIndex > -1 && this.imports) {
            this.imports[oldIndex].add(item);
            return;
        }
        this.imports?.push(new ImportComponent(from, item));
    }

    resolveImports() {
        const generator = PrismaNestBaseGenerator.getInstance();
        this.prismaModel.relationTypes?.forEach((relationClassName: any) => {
            this.registerImport(
                `${pascalCase(relationClassName)}`,
                FileComponent.TEMP_PREFIX + relationClassName
            );
        });
        this.prismaModel.enumTypes?.forEach((enumName: any) => {
            this.registerImport(enumName, generator.getClientImportPath());
        });

        this.prismaModel.decorators.forEach((decorator: any) => {
            this.registerImport(decorator.name, decorator.importFrom);
        });

        this.prismaModel.fields?.forEach((field: any) => {
            field.decorators.forEach((decorator: any) => {
                this.registerImport(decorator.name, decorator.importFrom);
            });
        });
    }

    write(dryRun: boolean) {
        if (this.dir && this.filename) {
            const generator = PrismaNestBaseGenerator.getInstance();

            const filePath = path.resolve(this.dir, this.filename);
            const content = prettierFormat(
                this.echo(),
                generator.prettierOptions
            );
            writeTSFile(filePath, content, dryRun);
        }
    }

    getRelativePath(to: string): string {
        return getRelativeTSPath(this.getPath() as string, to);
    }

    getPath() {
        if (this.dir && this.filename) {
            return path.resolve(this.dir, this.filename);
        }
    }
}
