import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/001_init.sql'), 'utf8');
const storageSql = fs.readFileSync(path.join(root, 'supabase/migrations/002_storage_job_photos.sql'), 'utf8');
const detail = fs.readFileSync(path.join(root, 'app/(app)/jobs/[id].tsx'), 'utf8');
const pairCard = fs.readFileSync(path.join(root, 'components/BeforeAfterPair.tsx'), 'utf8');
const finishButton = fs.readFileSync(path.join(root, 'components/JobFinishedButton.tsx'), 'utf8');
const list = fs.readFileSync(path.join(root, 'app/(app)/jobs/index.tsx'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'contexts/AuthContext.tsx'), 'utf8');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function tableColumns(source, table) {
  const match = source.match(
    new RegExp(`create table if not exists public\\.${table} \\(([\\s\\S]*?)\\n\\);`)
  );
  if (!match) fail(`missing create table public.${table}`);
  const columns = [];
  for (const line of match[1].split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('--') || trimmed.startsWith('constraint ')) continue;
    const name = trimmed.split(/\s+/)[0]?.replace(/,$/, '');
    if (name) columns.push(name);
  }
  return columns;
}

function assertSubset(label, used, allowed) {
  for (const column of used) {
    if (!allowed.includes(column)) fail(`${label} uses unknown column ${column}`);
  }
}

function selectColumns(source, table) {
  const match = source.match(
    new RegExp(`from\\('${table}'\\)[\\s\\S]*?\\.select\\(\\s*'([^']+)'`)
  );
  if (!match) fail(`missing ${table} select`);
  const raw = match[1].replace(/,\s*[a-z_]+:[\s\S]*$/, '');
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function insertColumns(source, table) {
  const match = source.match(new RegExp(`from\\('${table}'\\)\\s*\\.insert\\(\\{([\\s\\S]*?)\\}\\)`));
  if (!match) fail(`missing ${table} insert`);
  return [...match[1].matchAll(/^\s*([a-z_]+)\s*(?:,|:)/gm)].map((found) => found[1]);
}

const jobs = tableColumns(sql, 'jobs');
const notes = tableColumns(sql, 'job_notes');
const photos = tableColumns(sql, 'job_photos');
const profiles = tableColumns(sql, 'profiles');

assertSubset('jobs list select', selectColumns(list, 'jobs'), jobs);
assertSubset('jobs detail select', selectColumns(detail, 'jobs'), jobs);
assertSubset('job_notes select', selectColumns(detail, 'job_notes'), notes);
assertSubset('job_photos select', selectColumns(detail, 'job_photos'), photos);
assertSubset('profiles select', selectColumns(auth, 'profiles'), profiles);

const noteInsert = insertColumns(detail, 'job_notes');
assertSubset('job_notes insert', noteInsert, notes);
for (const required of ['job_id', 'author_id', 'body']) {
  if (!noteInsert.includes(required)) fail(`job_notes insert missing ${required}`);
}

const photoInsert = insertColumns(detail, 'job_photos');
assertSubset('job_photos insert', photoInsert, photos);
for (const required of ['job_id', 'storage_path', 'kind', 'created_by', 'caption']) {
  if (!photoInsert.includes(required)) fail(`job_photos insert missing ${required}`);
}
if (!detail.includes('captionFromNote')) {
  fail('photo upload must normalize the note into job_photos.caption');
}
if (!detail.includes('Add photo')) fail('job detail must show an Add photo control');
if (/\bfab:\s*\{/.test(detail)) fail('capture must not stay a bottom-right FAB');
if (!list.includes('Add photo')) fail('jobs list must show an Add photo control on each job');
if (!list.includes('addPhoto=1')) fail('jobs list Add photo must open the job upload flow');
if (!finishButton.includes('Mark complete')) fail('photo control must be labeled Mark complete');
if (finishButton.includes('Job Finished') || detail.includes('Job Finished')) {
  fail('user-facing Job Finished label must be renamed to Mark complete');
}
if (!detail.includes('Upload and mark complete')) fail('confirm button must say Upload and mark complete');
if (!detail.includes('‹ Back')) fail('job detail header must show a Back control');
if (!detail.includes("dismissTo('/(app)/jobs')")) fail('Back must return to the jobs list');
if (detail.includes('>Timeline<')) fail('job detail must not render a Timeline section');
if (!detail.includes('BeforeAfterPairCard')) fail('each work item must render as a BeforeAfterPair row');
if (!pairCard.includes('flexDirection: \'row\'')) fail('each work item must be a two-column row');
if (!pairCard.includes('contentFit="contain"')) fail('photos must show the full image');
if (pairCard.includes('contentFit="cover"') || detail.includes('contentFit="cover"')) {
  fail('photos must not crop with cover');
}
if (!pairCard.includes('<JobFinishedButton')) {
  fail('incomplete rows must show Mark complete in the completion column');
}
if (detail.includes('width: 110, height: 110')) fail('job photos must not be a thumbnail strip');
if (detail.includes("height: 220")) fail('job photos must not be full-width heroes');
if (detail.includes('showsHorizontalScrollIndicator')) fail('job photos must not be a horizontal strip');
if (detail.includes('buildTimeline')) fail('job detail must not rebuild a photo timeline');
if (!detail.includes("status: 'done'")) fail('Mark complete must set jobs.status to done');
if (!detail.includes("kind: 'before'") && !detail.includes('completionTarget')) {
  fail('Mark complete must link the completion photo to the original');
}
if (!detail.includes('storage_path: storagePath')) {
  fail('job_photos insert must persist the uploaded storage path');
}
if (detail.includes('storage_path: null')) {
  fail('job_photos insert still stubs storage_path');
}

const jobUpdate = detail.match(/from\('jobs'\)\.update\(\{\s*([^}]+)\}/);
if (!jobUpdate) fail('missing jobs update');
const updatedColumns = [...jobUpdate[1].matchAll(/([a-z_]+):/g)].map((found) => found[1]);
assertSubset('jobs update', updatedColumns, jobs);

const jobInsert = insertColumns(list, 'jobs');
assertSubset('jobs insert', jobInsert, jobs);
for (const required of ['title', 'property_address', 'status', 'created_by']) {
  if (!jobInsert.includes(required)) fail(`jobs insert missing ${required}`);
}

const policies = [
  ['001', sql, 'jobs_select_authenticated'],
  ['001', sql, 'jobs_update_authenticated'],
  ['001', sql, 'job_notes_select_authenticated'],
  ['001', sql, 'job_notes_insert_authenticated'],
  ['001', sql, 'job_photos_select_authenticated'],
  ['001', sql, 'job_photos_insert_authenticated'],
  ['001', sql, 'profiles_select_authenticated'],
  ['002', storageSql, 'job_photos_storage_select'],
  ['002', storageSql, 'job_photos_storage_insert'],
  ['002', storageSql, 'job_photos_storage_delete'],
];
for (const [file, source, policy] of policies) {
  if (!source.includes(`"${policy}"`)) fail(`${file} missing policy ${policy}`);
}

if (!storageSql.includes("'job-photos', 'job-photos', false")) {
  fail('002 must create a private job-photos bucket');
}
if (storageSql.includes("'job-photos', true") || storageSql.includes('public = true')) {
  fail('job-photos bucket must stay private');
}
if (!detail.includes('profiles!job_notes_author_id_fkey')) {
  fail('notes author embed does not match job_notes.author_id foreign key');
}
if (!detail.includes('profiles!job_photos_created_by_fkey')) {
  fail('photo author embed does not match job_photos.created_by foreign key');
}

console.log('jobs/notes/photos CRUD matches 001 schema and 002 storage RLS');
