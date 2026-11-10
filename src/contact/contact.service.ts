import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateContactDto } from './dto/create-contact.dto.js';
import { UpdateContactDto } from './dto/update-contact.dto.js';
import { Resend } from 'resend';

import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

import { dynamodb } from '../aws-config/dynamoDB_ranlogistics.js';
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';

@Injectable()
export class ContactService {
  private readonly tableContact = process.env.TABLE_CONTACT;
  private readonly resend: Resend;

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(this.config.get<string>(`API_RESEND`));
  }

  private getTableContact(): string {
    if (!this.tableContact) {
      throw new InternalServerErrorException('DB: Tabla no encontrada.');
    }
    return this.tableContact;
  }

  private async verifyRecaptcha(token: string): Promise<boolean> {
    if (!token) return false;

    const secretKey = process.env.RECAPTCHA_SECRET_KEY!;

    const urlGoogle = 'https://www.google.com/recaptcha/api/siteverify';

    const params = new URLSearchParams({
      secret: secretKey,
      response: token,
    });

    try {
      const response = await fetch(urlGoogle, {
        method: 'POST',
        body: params,
      });

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Error al momento de verificar reCATCHA', error);
      return false;
    }
  }  

  async create(createContactDto: CreateContactDto) {
    const isPerson = await this.verifyRecaptcha(
      createContactDto.recaptchaToken,
    ); 

    if (!isPerson) {
      throw new BadRequestException(
        'Error al validar reCAPTCHA, vuelva a intentarlo.',
      );
    } 

    const item = {
      id: randomUUID(),
      full_name: createContactDto.full_name,
      email: createContactDto.email,
      phone: createContactDto.phone,
      company: createContactDto.company,
      reason: createContactDto.reason,
      message: createContactDto.message,
    };

    try {
      await dynamodb.send(
        new PutCommand({
          TableName: this.getTableContact(),
          Item: item,
        }),
      );
    } catch (error) {
      console.error('DB ERROR: ', error);
      throw new InternalServerErrorException(
        'Error al guardar en la tabla contact',
      );
    }

    try {
      await this.resend.emails.send({
        from: 'RAN Logistics <notificaciones@ranlogistics.pe>',
        to: [process.env.EMAIL || 'ronaldobayona65@gmail.com'],
        subject: `Nuevo mensaje de ${createContactDto.full_name}`,
        html: `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nuevo mensaje de contacto</title>
      </head>

      <body style="margin:0;padding:0;background:#f5f8fc;font-family:Arial,Helvetica,sans-serif;color:#334155;">

        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
          style="background:#f5f8fc;padding:32px 16px;">
          <tr>
            <td align="center">

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                style="max-width:620px;background:#ffffff;border-radius:16px;overflow:hidden;">

                <tr>
                  <td style="background:#0b2239;padding:30px 32px;">
                    <div style="font-size:25px;font-weight:bold;color:#ffffff;">
                      RAN <span style="color:#f9844a;">LOGISTICS</span>
                    </div>

                    <div style="margin-top:8px;color:#cbd5e1;font-size:12px;letter-spacing:1px;">
                      OPERADOR LOGÍSTICO INTEGRAL
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="height:5px;background:#f9844a;"></td>
                </tr>

                <tr>
                  <td style="padding:34px 32px;">

                    <div style="color:#f9844a;font-size:12px;font-weight:bold;letter-spacing:1px;margin-bottom:10px;">
                      NOTIFICACIÓN WEB
                    </div>

                    <h1 style="margin:0;color:#0b3d91;font-size:25px;">
                      Nuevo mensaje de contacto
                    </h1>

                    <p style="margin:14px 0 28px;color:#64748b;font-size:14px;line-height:1.7;">
                      Se ha recibido una nueva solicitud desde el formulario de contacto de RAN Logistics.
                    </p>

                    <h2 style="margin:0 0 14px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;color:#0b2239;font-size:17px;">
                      Información del contacto
                    </h2>

                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                      style="font-size:14px;line-height:1.5;">

                      <tr>
                        <td width="125" style="padding:9px 0;color:#64748b;font-weight:bold;">Nombre</td>
                        <td style="padding:9px 0;color:#1e293b;">
                          ${createContactDto.full_name}
                        </td>
                      </tr>

                      <tr>
                        <td style="padding:9px 0;color:#64748b;font-weight:bold;">Email</td>
                        <td style="padding:9px 0;color:#1e293b;">
                          ${createContactDto.email}
                        </td>
                      </tr>

                      <tr>
                        <td style="padding:9px 0;color:#64748b;font-weight:bold;">Teléfono</td>
                        <td style="padding:9px 0;color:#1e293b;">
                          ${createContactDto.phone || 'No ingresado'}
                        </td>
                      </tr>

                      <tr>
                        <td style="padding:9px 0;color:#64748b;font-weight:bold;">Empresa</td>
                        <td style="padding:9px 0;color:#1e293b;">
                          ${createContactDto.company || 'No ingresada'}
                        </td>
                      </tr>

                      <tr>
                        <td style="padding:9px 0;color:#64748b;font-weight:bold;">Motivo</td>
                        <td style="padding:9px 0;color:#1e293b;">
                          ${createContactDto.reason || 'No especificado'}
                        </td>
                      </tr>

                    </table>

                    <h2 style="margin:30px 0 14px;color:#0b2239;font-size:17px;">
                      Mensaje recibido
                    </h2>

                    <div style="background:#f5f8fc;border-left:4px solid #f9844a;border-radius:6px;padding:18px;color:#334155;font-size:14px;line-height:1.8;white-space:pre-wrap;">
                      ${createContactDto.message}
                    </div>

                  </td>
                </tr>

                <tr>
                  <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 32px;text-align:center;">
                    <p style="margin:0 0 8px;color:#64748b;font-size:12px;">
                      Este correo fue generado automáticamente desde
                      <a href="https://ranlogistics.pe"
                        style="color:#0b3d91;text-decoration:none;font-weight:bold;">
                        ranlogistics.pe
                      </a>
                    </p>

                    <p style="margin:0;color:#94a3b8;font-size:11px;">
                      RAN Logistics · Operador logístico integral
                    </p>
                  </td>
                </tr>

              </table>

            </td>
          </tr>
        </table>

      </body>
      </html>
    `,
      });
    } catch (error) {
      console.error('Error Resend:', error);

      throw new InternalServerErrorException(
        'Error al enviar correo electrónico.',
      );
    }

    return item;
  }

  findAll() {
    return `This action returns all contact`;
  }

  findOne(id: number) {
    return `This action returns a #${id} contact`;
  }

  update(id: number, updateContactDto: UpdateContactDto) {
    return `This action updates a #${id} contact`;
  }

  remove(id: number) {
    return `This action removes a #${id} contact`;
  }
}
