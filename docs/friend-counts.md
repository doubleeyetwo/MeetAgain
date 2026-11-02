# Friend counts (Profile Page #64)

Both profile screens count accepted friendships only. Pending and declined
requests do not count. Own profiles listen to the same query as Friends List
(#41); other profiles read friendCounts/{uid} without exposing friendship lists.
Loading and errors never display a fabricated zero. A retry control is available.

Accepting or removing a friendship runs a Firestore transaction that updates
its relationship and both count documents together. Security rules require the
matching +1/-1 transition, membership, and both updates. The lastPairId field
links a count write to its relationship. Concurrent changes retry through
Firestore transactions. New registrations initialize count to zero in the
profile creation transaction.

This works on Spark: no Cloud Functions or billing upgrade is needed.

## One-time activation for meetagain-143a8

On October 14, 2026, the local rules were merged with the deployed public-profile
and profile-edit permissions. The browser simulator verified signed-in count
reads are allowed, anonymous reads are denied, and fabricated count creation for
an existing account is denied. The active published version (October 14 at
10:30 AM, as displayed in the console) was reopened and compared with the local
rules: they match after ignoring comments and whitespace. Deployment is verified.

The browser backfill completed after intermittent access failures. All ten
documents below were confirmed in the collection:

| UID | Count |
| --- | ---: |
| 33x1TNHC6jh0C8puNGrFEhycb2Y2 | 2 |
| 4mEPfbWUxiamqkAptdSQszFNmt62 | 1 |
| 5tMMd0ZdZxP2OoUkWE47ahjTMD03 | 0 |
| 8Et09W5PFPSkIZcuslFSZY6q1Y83 | 0 |
| TitboW39zqZ7mzXH0KYezGxxCfe2 | 0 |
| U6jvIndL5rXqZ6ZjCxqxOCNhhcz1 | 1 |
| ZMtfbEs42pY3p0u55GpVTTRSoT73 | 0 |
| ZP95zwwgANP92ObwqJWak82EgoE3 | 0 |
| gz4CtKuM0of4a8DrUjSTJ4yfuuB3 | 0 |
| rBPugJHKuiUyt9OznPqvAEf2Dk92 | 0 |

The source data was rechecked: two accepted pairs involving blakeflakes and one
pending pair. No existing friendships were changed. Live app transaction checks
with signed-in test accounts remain to be completed.

Against the active published rules, the console simulator also confirmed that
another signed-in account can read a total while that same account cannot read
the owner's private users document. The standalone unfriend simulation could
not run: Firebase reported that its simulator does not support getAfter. This
was not a rejected live write and must not be counted as a passing write-rule
test. Use real test-account transactions or the Firestore emulator for the
remaining acceptance/removal and count-tampering checks. No live friendships
were accepted or deleted during these simulations.

Existing accounts need accurate baselines before the new accept/remove flow works.
The app refuses to guess an initial total. The maintenance script uses the Admin
SDK locally; it is not a deployed function.

1. Have the team pause accepting/removing friendships during migration.
2. Compare firestore.rules with the currently deployed rules and merge the
   friendCounts block and friendship count checks into the current version.
   Preserve deployed public-profile/edit-profile permissions missing locally.
3. Deploy the merged rules through the console or authenticated Firebase CLI:
   `firebase deploy --project meetagain-143a8 --only firestore:rules`.
4. Install maintenance dependencies:
   `npm ci --prefix scripts/friend-counts`.
5. With authorized Google Application Default Credentials for the project, run:
   `npm --prefix scripts/friend-counts run backfill -- meetagain-143a8`.
   Do not commit credentials. No billing upgrade is required.
6. Release this app version to everyone. Older clients cannot accept/remove
   friends under the new rules because they do not update both totals.

The backfill is safe to rerun. It scans users and friendship participants in
pages and recalculates accepted relationships in a transaction. No extra composite
index is needed. For a small test dataset, an administrator can instead initialize
friendCounts/{uid} with an integer count equal to the exact number of accepted
pairs containing that UID. Never assume an existing account has zero friends.

## Validation

Run `npm run typecheck` and `node --test scripts/friend-counts/*.test.*`.
After deploying/backfilling, verify with two test accounts:

- Zero friends displays zero on both profile views.
- Sending/declining a request does not change either total.
- Accepting increments both totals; removing decrements both; the list agrees.
- Concurrent accept/remove attempts cannot apply a change twice.
- Switching profiles/accounts never displays the previous person's count.
- Missing/unavailable totals show loading/error with retry, not a false zero.
- Rules reject arbitrary or standalone count changes, accept/delete without both
  totals, negative counts, outsiders, and another person's friendship-list query.

Local tests do not replace live rules and two-account checks. Use the team's
current deployed rules as the migration baseline, rather than overwriting them.
