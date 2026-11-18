import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/** Validasi body dengan Zod; error dikembalikan dalam bentuk ringkas & ramah client. */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T>) {}
  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const errors = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      throw new BadRequestException({ message: errors[0]?.message ?? 'Validation failed', errors });
    }
    return result.data;
  }
}
