/** True when PostgREST rejected a query because job_number is not on the live table yet. */
export function isMissingJobNumberColumn(message: string) {
  return /job_number/i.test(message);
}

export function formatJobNumber(jobNumber: number | null | undefined) {
  if (jobNumber == null || Number.isNaN(Number(jobNumber))) return null;
  return `#${jobNumber}`;
}
