import tap from 'tap';
import type { IDirectorySyncController, Directory, Storable } from '../../src/typings';
import { getFakeDirectory } from './data/directories';
import { jacksonOptions } from '../utils';
import DB from '../../src/db/db';
import { keyFromParts } from '../../src/db/utils';
import { indexNames } from '../../src/directory-sync/scim/utils';
import { storeNamespacePrefix } from '../../src/controller/utils';
import { backfillUserNameIndex } from '../../scripts/backfill-username-index';

let directorySync: IDirectorySyncController;
let directory: Directory;
let userStore: Storable;
let db: { store: (namespace: string) => Storable };

const fakeDirectory = getFakeDirectory();

// A record shaped like the pre-fix code stored it: indexed under the
// original-cased email, no top-level userName.
const buildLegacyUser = (id: string, email: string, rawUserName?: string) => {
  return {
    id,
    email,
    first_name: 'Legacy',
    last_name: 'User',
    active: true,
    raw: {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      ...(rawUserName ? { userName: rawUserName } : undefined),
      active: true,
      id,
    },
  };
};

const seedLegacyUser = async (user: ReturnType<typeof buildLegacyUser> & { directoryId?: string }) => {
  await userStore.put(
    user.id,
    user,
    {
      // Pre-fix index shape: original-cased email instead of lowercased userName.
      name: indexNames.directoryIdUsername,
      value: keyFromParts(directory.id, user.email),
    },
    {
      name: indexNames.directoryId,
      value: directory.id,
    }
  );
};

const searchByUserName = async (userName: string) => {
  directorySync.users.setTenantAndProduct(directory.tenant, directory.product);

  const { data } = await directorySync.users.search(userName, directory.id);

  return data || [];
};

tap.before(async () => {
  const jackson = await (await import('../../src/index')).default(jacksonOptions);

  directorySync = jackson.directorySyncController;

  const { data, error } = await directorySync.directories.create(fakeDirectory);

  if (error || !data) {
    tap.fail("Couldn't create a directory");
    return;
  }

  directory = data;

  // DB.new returns the instance the controller above was initialized with
  // (module-level cache), so seeded records land in the same store the
  // backfill reads.
  db = await DB.new({ db: jacksonOptions.db, logger: console as any });

  userStore = db.store(keyFromParts(storeNamespacePrefix.dsync.users, directory.tenant, directory.product));
});

tap.teardown(async () => {
  process.exit(0);
});

tap.test('backfill-username-index /', async (t) => {
  t.teardown(async () => {
    await directorySync.directories.delete(directory.id);
  });

  t.test('legacy record is not reachable via the lowercased userName lookup (bug repro)', async (t) => {
    const legacyUser = buildLegacyUser('legacy-user-1', 'Legacy.User@example.com', 'Legacy.User@example.com');

    await seedLegacyUser({ ...legacyUser, directoryId: directory.id });

    // The post-fix lookup (lowercased userName) misses the legacy record...
    const found = await searchByUserName(legacyUser.raw.userName as string);

    t.equal(found.length, 0);

    // ...while the legacy original-cased email index still resolves it.
    const { data: legacyIndexed } = await userStore.getByIndex({
      name: indexNames.directoryIdUsername,
      value: keyFromParts(directory.id, legacyUser.email),
    });

    t.equal(legacyIndexed?.[0]?.id, legacyUser.id);
  });

  t.test('dry-run reports the record without writing', async (t) => {
    const result = await backfillUserNameIndex(db, { dryRun: true });

    t.equal(result.totalBackfilled, 1);
    t.equal(result.errors.length, 0);

    const found = await searchByUserName('legacy.user@example.com');

    t.equal(found.length, 0);
  });

  t.test('backfill writes the index and the top-level userName', async (t) => {
    const result = await backfillUserNameIndex(db, { dryRun: false });

    t.equal(result.totalBackfilled, 1);
    t.equal(result.errors.length, 0);

    // The post-fix lookup now resolves the record.
    const found = await searchByUserName('legacy.user@example.com');

    t.equal(found[0]?.id, 'legacy-user-1');

    // Top-level userName is populated with the original casing.
    const stored = await userStore.get('legacy-user-1');

    t.equal(stored?.userName, 'Legacy.User@example.com');

    // The legacy email-keyed index row is left in place (exact-match lookups
    // make stale rows inert).
    const { data: legacyIndexed } = await userStore.getByIndex({
      name: indexNames.directoryIdUsername,
      value: keyFromParts(directory.id, 'Legacy.User@example.com'),
    });

    t.equal(legacyIndexed?.[0]?.id, 'legacy-user-1');
  });

  t.test('re-run is a no-op (idempotent)', async (t) => {
    const result = await backfillUserNameIndex(db, { dryRun: false });

    t.equal(result.totalBackfilled, 0);
    t.equal(result.totalUpToDate, 1);
    t.equal(result.errors.length, 0);
  });

  t.test('record without a top-level directoryId falls back to the namespace directory', async (t) => {
    // PUT-updated records are stored without a top-level directoryId.
    const legacyUser = buildLegacyUser('legacy-user-2', 'Renamed.User@example.com', 'Renamed.User@example.com');

    await seedLegacyUser(legacyUser);

    const result = await backfillUserNameIndex(db, { dryRun: false });

    t.equal(result.totalBackfilled, 1);
    t.equal(result.errors.length, 0);

    const found = await searchByUserName('renamed.user@example.com');

    t.equal(found[0]?.id, 'legacy-user-2');
  });

  t.test('record without raw.userName falls back to email', async (t) => {
    const legacyUser = buildLegacyUser('legacy-user-3', 'NoUserName.User@example.com');

    await seedLegacyUser({ ...legacyUser, directoryId: directory.id });

    const result = await backfillUserNameIndex(db, { dryRun: false });

    t.equal(result.totalBackfilled, 1);
    t.equal(result.errors.length, 0);

    const found = await searchByUserName('nousername.user@example.com');

    t.equal(found[0]?.id, 'legacy-user-3');

    const stored = await userStore.get('legacy-user-3');

    t.equal(stored?.userName, 'NoUserName.User@example.com');
  });
});
