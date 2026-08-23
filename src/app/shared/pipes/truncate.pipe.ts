import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';

@Pipe({ name: 'truncate' })
export class TruncatePipe implements PipeTransform {
  transform(value: string | null | undefined, limit = 80, suffix = '…'): string {
    if (!value) return '';
    return value.length <= limit ? value : value.slice(0, limit).trimEnd() + suffix;
  }
}
