import { snakeCase } from "change-case";
import * as path from "path";
import { Echoable } from "../interfaces/echoable";
import { FileComponent } from "./file.component";
import { FieldComponent } from "./field.component";
import { MODEL_TEMPLATE } from "../templates/model.template";
import { BaseComponent } from "./base.component";
import { logger } from "@prisma/sdk";

export class ModelComponent extends BaseComponent implements Echoable {
    name: string;
    fields?: FieldComponent[];
    relationTypes?: string[];
    enumTypes?: string[] = [];

    echo = () => {
        // console.log(this.enumTypes)
        let fieldContent;
        if (this.fields)
            fieldContent = this.fields.map((_field) => _field.echo());

        if (!fieldContent) throw logger.error("BAD FIELD CONTENT");
        let str = MODEL_TEMPLATE.replace(
            "#!{DECORATORS}",
            this.echoDecorators()
        )
            .replace("#!{NAME}", `${this.name}`)
            .replace("#!{FIELDS}", fieldContent.join("\r\n"));

        if (this.enumTypes)
            if (this.enumTypes.length > 0) {
                for (const enumType of this.enumTypes) {
                    str += `registerEnumType(${enumType}, {
	name: "${enumType}",
});
`;
                }
            }

        return str;
    };

    reExportPrefixed = (prefix: string) => {
        return `export class ${this.name} extends ${prefix}${this.name} {}`;
    };
}
