/**
 * [LEV-2248] Backfill the `directoryIdUsername` secondary index (and the
 * top-level `userName` field) for legacy dsync user records.
 *
 * Why: the v26.2.0 SCIM fix changed the `directoryIdUsername` index value from
 * `directoryId:email` (original casing) to `directoryId:userName.toLowerCase()`.
 * Index lookups are exact-match on RIPEMD-160 digests, so records created
 * before the fix are unreachable by the new lookups: the IdP's
 * `GET /Users?filter=userName eq ...` pre-check returns empty, the IdP falls
 * back to POST, and a duplicate record is created on the next re-provision.
 *
 * What it does, for every user record reachable from a configured directory:
 *   1. Computes the index value exactly like Users.create():
 *      (raw.userName || email).toLowerCase()
 *   2. Re-puts the record with `userName` populated top-level and the
 *      `directoryIdUsername` + `directoryId` indexes attached. The SQL layer
 *      no-ops index rows whose {key, storeKey} pair already exists, so the
 *      script is idempotent and safe to re-run.
 *   3. Leaves the legacy email-keyed index rows in place: lookups are
 *      exact-match on the digest, so stale rows are inert.
 *
 * Usage (from the npm/ directory, with the same DB env as the running app):
 *   DB_URL=... DB_ENCRYPTION_KEY=... npm run db:backfill:username-index -- --dry-run
 *   DB_URL=... DB_ENCRYPTION_KEY=... npm run db:backfill:username-index
 *
 * DB_ENCRYPTION_KEY must match the running app's key (omit it if the app runs
 * without one); otherwise decryption of store values fails.
 */
import DB from '../src/db/db';
import { keyFromParts } from '../src/db/utils';
import { indexNames } from '../src/directory-sync/scim/utils';
import { storeNamespacePrefix } from '../src/controller/utils';
import type { DatabaseEngine, DatabaseType, Directory, Storable, User } from '../src/typings';

const PAGE_LIMIT = 50;

type BackfillResult = {
  totalRecords: number;
  totalUpToDate: number;
  totalBackfilled: number;
  errors: string[];
};

// Drain a store with offset pagination. Collects everything up front so writes
// during the backfill cannot interleave with pagination.
const getAllRecords = async (store: Storable): Promise<any[]> => {
  const records: any[] = [];

  let offset = 0;
  while (true) {
    const { data } = await store.getAll(offset, PAGE_LIMIT);

    if (!data || data.length === 0) {
      break;
    }

    records.push(...data);
    offset += data.length;
  }

  return records;
};

export const backfillUserNameIndex = async (
  db: { store: (namespace: string) => Storable },
  { dryRun }: { dryRun: boolean }
): Promise<BackfillResult> => {
  // Each directory's users live in the `dsync:users:{tenant}:{product}`
  // namespace. Multiple directories can share a tenant:product pair, so group
  // first and process each namespace exactly once.
  const directories = (await getAllRecords(db.store(storeNamespacePrefix.dsync.config))) as Directory[];

  const directoriesByNamespace = new Map<string, Directory[]>();

  for (const directory of directories) {
    const namespace = keyFromParts(storeNamespacePrefix.dsync.users, directory.tenant, directory.product);
    directoriesByNamespace.set(namespace, [...(directoriesByNamespace.get(namespace) || []), directory]);
  }

  const result: BackfillResult = {
    totalRecords: 0,
    totalUpToDate: 0,
    totalBackfilled: 0,
    errors: [],
  };

  for (const [namespace, namespaceDirectories] of directoriesByNamespace) {
    const userStore = db.store(namespace);
    const users = (await getAllRecords(userStore)) as (User & { directoryId?: string })[];

    let upToDate = 0;
    let backfilled = 0;

    for (const user of users) {
      if (!user.id) {
        result.errors.push(`${namespace}: record without an id, skipped`);
        continue;
      }

      // The same value Users.create()/update() index on.
      const rawUserName = typeof user.raw?.userName === 'string' ? user.raw.userName : '';
      const userName = rawUserName || user.email;

      if (!userName) {
        result.errors.push(`${namespace} user ${user.id}: no raw.userName or email, skipped`);
        continue;
      }

      // PUT-updated records lack a top-level directoryId; fall back to the
      // namespace's directory when it is unambiguous.
      const directoryId =
        user.directoryId || (namespaceDirectories.length === 1 ? namespaceDirectories[0].id : null);

      if (!directoryId) {
        result.errors.push(
          `${namespace} user ${user.id}: no directoryId and ${namespaceDirectories.length} directories share the namespace, skipped`
        );
        continue;
      }

      const indexValue = keyFromParts(directoryId, userName.toLowerCase());

      // Already reachable via the new index with userName populated? Nothing to do.
      const { data: indexed } = await userStore.getByIndex({
        name: indexNames.directoryIdUsername,
        value: indexValue,
      });
      const alreadyIndexed = (indexed || []).some((indexedUser: User) => indexedUser.id === user.id);

      if (alreadyIndexed && user.userName === userName) {
        upToDate++;
        continue;
      }

      backfilled++;

      if (dryRun) {
        console.info(
          `[dry-run] ${namespace} user ${user.id}: would write directoryIdUsername index` +
            `${alreadyIndexed ? ' (already present)' : ''} and set top-level userName` +
            `${rawUserName ? '' : ' (email fallback)'}`
        );
        continue;
      }

      // The same put() shape as Users.update(). Index rows whose
      // {key, storeKey} pair already exists are no-ops; legacy email-keyed
      // rows are left in place.
      await userStore.put(
        user.id,
        { ...user, userName },
        {
          name: indexNames.directoryIdUsername,
          value: indexValue,
        },
        {
          name: indexNames.directoryId,
          value: directoryId,
        }
      );
    }

    result.totalRecords += users.length;
    result.totalUpToDate += upToDate;
    result.totalBackfilled += backfilled;

    console.info(
      `${namespace}: ${users.length} records, ${upToDate} up to date, ${backfilled} ${dryRun ? 'to backfill' : 'backfilled'}`
    );
  }

  return result;
};

const main = async () => {
  const dryRun = process.argv.includes('--dry-run');

  const dbUrl = process.env.DB_URL || process.env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error('DB_URL is required');
  }

  const db = await DB.new({
    db: {
      engine: (process.env.DB_ENGINE as DatabaseEngine) || 'sql',
      type: (process.env.DB_TYPE as DatabaseType) || 'postgres',
      url: dbUrl,
      encryptionKey: process.env.DB_ENCRYPTION_KEY,
      // Never let the script create or alter tables; schema is managed by the
      // app's migrations.
      manualMigration: true,
    },
    logger: console,
  });

  const { totalRecords, totalUpToDate, totalBackfilled, errors } = await backfillUserNameIndex(db, {
    dryRun,
  });

  console.info(
    `${dryRun ? '[dry-run] ' : ''}Done. ${totalRecords} records, ${totalUpToDate} up to date, ${totalBackfilled} ${dryRun ? 'need backfill' : 'backfilled'}, ${errors.length} errors.`
  );

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(error);
    }
    process.exit(1);
  }

  process.exit(0);
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
