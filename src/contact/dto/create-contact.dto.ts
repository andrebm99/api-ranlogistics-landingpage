import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";


export class CreateContactDto {
 
 @IsString()
 @ApiProperty({ required: true })
 full_name: string;
 
 @ApiProperty({required: true})
 @IsString()
 email: string;

 @ApiProperty({ required: true})
 @IsString()
 @MinLength(9)
 @MaxLength(13)
 phone: string;

 @ApiProperty({ required: true })
 @IsString()
 company: string;

 @ApiProperty({ required: true })
 @IsString()
 reason: string;
 
 @ApiProperty({ required: true })
 @IsString()
 message: string;   

 @ApiProperty({
    required: true,
    description:
      'Token de validación generado por Google reCAPTCHA v2 en el Front',
  })
  @IsString()
  @IsNotEmpty({ message: 'El token de reCAPTCHA es obligatorio' })
  recaptchaToken!: string;  
}

