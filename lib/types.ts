export type UserRole = 'owner_admin' | 'employee' | 'customer';

export type JobStatus = 'open' | 'in_progress' | 'done' | 'cancelled';

export type PhotoKind = 'before' | 'after' | 'general';

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
};

export type Job = {
  id: string;
  title: string;
  property_address: string | null;
  status: JobStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type JobNote = {
  id: string;
  job_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  author?: Pick<Profile, 'id' | 'full_name'> | null;
};

export type JobPhoto = {
  id: string;
  job_id: string;
  storage_path: string | null;
  local_uri: string | null;
  lat: number | null;
  lng: number | null;
  caption: string | null;
  kind: PhotoKind;
  pair_id: string | null;
  created_by: string | null;
  created_at: string;
  author?: Pick<Profile, 'id' | 'full_name'> | null;
};

/** Unified timeline item for CompanyCam-style feed */
export type TimelineItem =
  | { type: 'photo'; created_at: string; photo: JobPhoto }
  | { type: 'note'; created_at: string; note: JobNote };

export type BeforeAfterPair = {
  pair_id: string;
  before: JobPhoto | null;
  after: JobPhoto | null;
};
