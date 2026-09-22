import { confirmChoice } from '@/lib/dialog';
import { JOB_PHOTOS_BUCKET } from '@/lib/photo-storage';
import { getSupabase } from '@/lib/supabase';

export function confirmDeleteJob(jobTitle: string, jobNumber: number | null | undefined): Promise<boolean> {
  const which = jobNumber != null ? `job #${jobNumber}` : 'this job';
  return confirmChoice(
    'Delete job',
    `Permanently delete ${which}, “${jobTitle}”? Photos and notes are removed. This cannot be undone.`,
    'Delete'
  );
}

/** Remove storage objects, notes, photos, and the job row. Verifies the job row is gone. */
export async function deleteJobPermanently(jobId: string): Promise<void> {
  const supabase = getSupabase();
  const { data: photos, error: photoErr } = await supabase
    .from('job_photos')
    .select('storage_path')
    .eq('job_id', jobId);
  if (photoErr) throw photoErr;

  const paths = (photos ?? [])
    .map((row) => row.storage_path)
    .filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    await supabase.storage.from(JOB_PHOTOS_BUCKET).remove(paths);
  }

  const { error: notesErr } = await supabase.from('job_notes').delete().eq('job_id', jobId);
  if (notesErr) throw notesErr;

  const { error: photosDelErr } = await supabase.from('job_photos').delete().eq('job_id', jobId);
  if (photosDelErr) throw photosDelErr;

  const { data, error } = await supabase.from('jobs').delete().eq('id', jobId).select('id');
  if (error) throw error;
  if (!data?.length) {
    throw new Error(
      'Delete did not remove the job. Run supabase/migrations/004_jobs_job_number_and_delete.sql in the Supabase SQL Editor, then try again.'
    );
  }
}
