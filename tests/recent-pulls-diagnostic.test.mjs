import test from 'node:test';import assert from 'node:assert/strict';
import {recentPullQuery,explainPullError,checkRecentPulls} from '../scripts/check-recent-pulls.mjs';
test('diagnostic checks the exact bounded public ranking query and isolates modes',()=>{
 const q=recentPullQuery('biggest',1800000000000).structuredQuery;
 assert.deepEqual(q.from,[{collectionId:'liveRecentPulls'}]);assert.equal(q.limit,12);assert.equal(q.where.compositeFilter.filters.length,2);
 assert.deepEqual(q.orderBy,[{field:{fieldPath:'valueCents'},direction:'DESCENDING'},{field:{fieldPath:'pulledAtMs'},direction:'DESCENDING'}]);
 assert.equal(recentPullQuery('latest',1800000000000,'test').structuredQuery.from[0].collectionId,'testRecentPulls');
 assert.throws(()=>recentPullQuery('private'));assert.throws(()=>recentPullQuery('latest',0,'accounts'));
});
test('diagnostic distinguishes an index still building, missing indexes, rejected queries and deployed rules',()=>{
 assert.match(explainPullError({status:'FAILED_PRECONDITION',message:'Index is building and cannot be used yet'}),/still building/);
 assert.match(explainPullError({status:'FAILED_PRECONDITION',message:'The query requires an index'}),/missing/);
 assert.match(explainPullError({status:'PERMISSION_DENIED'}),/Rules/);
 assert.match(explainPullError({status:'INVALID_ARGUMENT'}),/query shape/);
});
test('invalid project or mode cannot trigger network or gcloud operations',async()=>{
 await assert.rejects(checkRecentPulls('bad/project'));await assert.rejects(checkRecentPulls('rippr-2b01c','customerAccounts'));
});
