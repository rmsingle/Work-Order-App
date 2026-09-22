import assert from 'node:assert/strict';
import {
  buildObjectPath,
  captionFromNote,
  contentTypeForMime,
  extensionForMime,
  photoDisplayUri,
} from '../lib/photo-storage.ts';

assert.equal(contentTypeForMime('image/jpg'), 'image/jpeg');
assert.equal(contentTypeForMime('image/png; charset=binary'), 'image/png');
assert.equal(contentTypeForMime(null), 'image/jpeg');
assert.equal(extensionForMime('image/heic'), 'heic');

const path = buildObjectPath('job-1', 'image/png', 'abc');
assert.equal(path, 'job-1/abc.png');
assert.equal(path.includes('..'), false);

const signed = { 'job-1/abc.png': 'https://example.supabase.co/storage/v1/object/sign/job-photos/job-1/abc.png?token=t' };
const synced = photoDisplayUri(
  { storage_path: 'job-1/abc.png', local_uri: 'file:///other-device/photo.jpg' },
  signed
);
assert.equal(synced, signed['job-1/abc.png']);

const missingSign = photoDisplayUri(
  { storage_path: 'job-1/abc.png', local_uri: 'file:///other-device/photo.jpg' },
  {}
);
assert.equal(missingSign, null);

const legacy = photoDisplayUri({ storage_path: null, local_uri: 'file:///this-device/photo.jpg' }, {});
assert.equal(legacy, 'file:///this-device/photo.jpg');

assert.equal(captionFromNote('  west unit filter  '), 'west unit filter');
assert.equal(captionFromNote('   '), null);
assert.equal(captionFromNote(null), null);
assert.equal(captionFromNote(undefined), null);

console.log('photo storage display checks passed');
