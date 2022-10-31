import fs from "fs";
import path from "path";
import { resolveConfig, format } from "prettier";
//import { formatFile } from './formatFile'
import { logger } from "@prisma/sdk";
export const writeFileSafely = async (writeLocation: string, content: any) => {
    fs.mkdirSync(path.dirname(writeLocation), {
        recursive: true
    });
    logger.info(`write location:${writeLocation}`);
    logger.info(`write content:${content}`);
    let formattedFile = content;
    try {
        const formatRun = await formatFile(content);
        logger.info(`write contentf:${formatRun}`);
        if (formatRun) formattedFile = formatRun;
    } catch (e) {
        logger.error("prisma error" + e);
    }
    logger.info(`write content format:${formattedFile}`);
    fs.writeFileSync(writeLocation, formattedFile);
};
export const formatFile = (content: string): Promise<string> => {
    return new Promise((res, rej) => {
        const options = resolveConfig.sync(process.cwd());
        logger.info("res: " + options);
        logger.log("formatting content");
        if (!options) {
            res(content); // no prettier config was found, no need to format
        }

        try {
            const formatted = format(content, {
                ...options,
                parser: "typescript"
            });

            res(formatted);
        } catch (error) {
            rej(error);
        }
    });
};
