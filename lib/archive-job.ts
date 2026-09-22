import { confirmChoice } from '@/lib/dialog';

/** Confirm before a job leaves the active dashboard. */
export function confirmArchiveJob(jobTitle: string): Promise<boolean> {
  return confirmChoice(
    'Archive job',
    `Archive “${jobTitle}”? It will leave the active Jobs list. Photos stay saved.`,
    'Archive'
  );
}
