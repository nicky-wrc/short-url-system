import { z } from 'zod';

export const tagSchema = z.string().transform(value => value.normalize('NFC').trim().toLowerCase())
  .pipe(z.string().min(1).max(32).refine(value => !/[\p{Cc}\p{Cf},]/u.test(value), 'Tags cannot contain commas or control characters.'));
export const tagsSchema = z.array(tagSchema).max(8).transform(tags => [...new Set(tags)].sort());
