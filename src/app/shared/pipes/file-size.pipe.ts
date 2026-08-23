import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';
import { formatBytes } from '../../core/utils/file.utils';

@Pipe({ name: 'fileSize' })
export class FileSizePipe implements PipeTransform {
  transform(bytes: number | null | undefined, decimals = 1): string {
    return formatBytes(bytes ?? 0, decimals);
  }
}
