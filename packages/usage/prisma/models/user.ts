import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class User {
    @ApiProperty({ type: Number })
    id: number = undefined;

    @ApiProperty({ type: String })
    email: string = undefined;

    @ApiPropertyOptional({ type: String })
    name?: string = undefined;
}
