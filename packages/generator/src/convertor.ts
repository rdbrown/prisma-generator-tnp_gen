import { DMMF } from "@prisma/generator-helper";
import { DecoratorComponent } from "./components/decorator.component";
import { FieldComponent } from "./components/field.component";
import { ModelComponent } from "./components/model.component";
import { PrismaNestBaseGeneratorConfig } from "./generator";
import {
    arrayify,
    capitalizeFirst,
    uniquify,
    wrapArrowFunction,
    wrapQuote
} from "./utils";

/** BigInt, Boolean, Bytes, DateTime, Decimal, Float, Int, JSON, String, $ModelName */
type DefaultPrismaFieldType =
    | "BigInt"
    | "Boolean"
    | "Bytes"
    | "DateTime"
    | "Decimal"
    | "Float"
    | "Int"
    | "Json"
    | "String";

const primitiveMapType: Record<DefaultPrismaFieldType, string> = {
    Int: "number",
    String: "string",
    DateTime: "Date",
    Boolean: "boolean",
    Json: "object",
    BigInt: "BigInt",
    Float: "number",
    Decimal: "number",
    Bytes: "Buffer"
} as const;

export type PrimitiveMapTypeKeys = keyof typeof primitiveMapType;
export type PrimitiveMapTypeValues =
    typeof primitiveMapType[PrimitiveMapTypeKeys];

export interface ConvertModelInput {
    model: DMMF.Model;
    extractRelationFields?: boolean;
    postfix?: string;
    useGraphQL?: boolean;
}

export interface SwaggerDecoratorParams {
    isArray?: boolean;
    type?: string;
    enum?: string;
    enumName?: string;
}

export class PrismaConvertor {
    static instance: PrismaConvertor;
    private _config: PrismaNestBaseGeneratorConfig;
    private _dmmf: DMMF.Document;

    public get dmmf() {
        return this._dmmf;
    }

    public set dmmf(value) {
        this._dmmf = value;
    }

    public get config() {
        return this._config;
    }

    public set config(value) {
        this._config = value;
    }

    static getInstance() {
        if (PrismaConvertor.instance) {
            return PrismaConvertor.instance;
        }
        PrismaConvertor.instance = new PrismaConvertor();
        return PrismaConvertor.instance;
    }

    getPrimitiveMapTypeFromDMMF = (
        dmmfField: DMMF.Field
    ): PrimitiveMapTypeValues => {
        if (typeof dmmfField.type !== "string") {
            return "unknown";
        }
        const fieldType: string = dmmfField.type;
        //@ts-ignore
        const res = primitiveMapType[fieldType];

        return res;
    };

    getModel = (input: ConvertModelInput): ModelComponent => {
        /** options */
        const options: ConvertModelInput = Object.assign(
            {
                extractRelationFields: null
            },
            input
        );
        const { model, extractRelationFields = null, postfix } = options;

        /** set class name */
        let className: string = model.name;
        if (postfix) {
            className += postfix;
        }
        const classComponent = new ModelComponent({ name: className });

        /** relation & enums */
        const relationTypes = uniquify(
            model.fields
                .filter(
                    (field) => field.relationName && model.name !== field.type
                )
                .map((v) => v.type)
        );
        const enums = model.fields.filter((field) => field.kind === "enum");

        classComponent.fields = model.fields
            .filter((field) => {
                if (extractRelationFields === true) {
                    return field.relationName;
                }
                if (extractRelationFields === false) {
                    return !field.relationName;
                }
                return true;
            })
            .map((field) => this.convertField(field));
        classComponent.relationTypes =
            extractRelationFields === false ? [] : relationTypes;

        classComponent.enumTypes =
            extractRelationFields === true
                ? []
                : enums.map((field) => field.type.toString());

        return classComponent;
    };

    getModels = (): ModelComponent[] => {
        const models = this.dmmf.datamodel.models;

        /** separateRelationFields */
        if (this.config.separateRelationFields === true) {
            return [
                ...models.map((model) =>
                    this.getModel({
                        model,
                        extractRelationFields: true,
                        postfix: "Relations"
                    })
                ),
                ...models.map((model) =>
                    this.getModel({
                        model,
                        extractRelationFields: false
                    })
                )
            ];
        }

        return models.map((model) => this.getModel({ model }));
    };

    extractSwaggerDecoratorFromField = (
        dmmfField: DMMF.Field
    ): DecoratorComponent => {
        const options: SwaggerDecoratorParams = {};
        const name =
            dmmfField.isRequired === true
                ? "ApiProperty"
                : "ApiPropertyOptional";
        const decorator = new DecoratorComponent({
            name: name,
            importFrom: "@nestjs/swagger"
        });

        let type = this.getPrimitiveMapTypeFromDMMF(dmmfField);
        if (type && type !== "any") {
            options.type = capitalizeFirst(type);
            decorator.params.push(options);
            return decorator;
        }
        type = dmmfField.type.toString();

        if (dmmfField.isList) {
            options.isArray = true;
        }

        if (dmmfField.relationName) {
            options.type = wrapArrowFunction(dmmfField);
            decorator.params.push(options);
            return decorator;
        }

        if (dmmfField.kind === "enum") {
            options.enum = dmmfField.type;
            options.enumName = wrapQuote(dmmfField);
        }

        decorator.params.push(options);
        return decorator;
    };

    convertField = (dmmfField: DMMF.Field): FieldComponent => {
        const field = new FieldComponent({
            name: dmmfField.name
        });
        let type = this.getPrimitiveMapTypeFromDMMF(dmmfField);

        if (this.config.useSwagger) {
            const decorator = this.extractSwaggerDecoratorFromField(dmmfField);
            field.decorators.push(decorator);
        }

        if (dmmfField.isRequired === false) {
            field.nullable = true;
        }

        if (dmmfField.default) {
            if (typeof dmmfField.default !== "object") {
                field.default = dmmfField.default?.toString();
                if (dmmfField.kind === "enum") {
                    field.default = `${dmmfField.type}.${dmmfField.default}`;
                } else if (dmmfField.type === "BigInt") {
                    field.default = `BigInt(${field.default})`;
                } else if (dmmfField.type === "String") {
                    field.default = `'${field.default}'`;
                }
            }
        }

        if (type) {
            field.type = type;
            return field;
        }
        field.type = dmmfField.type;

        if (dmmfField.isList) {
            field.type = arrayify(field.type);
        }

        return field;
    };
}
