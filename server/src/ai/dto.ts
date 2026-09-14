import { IsNotEmpty, IsString } from 'class-validator';

export class RecognizeDto {
  /** data:image/png;base64,xxxx 格式（小程序端拍照后压缩转 base64） */
  @IsString() @IsNotEmpty() imageBase64: string;
}
