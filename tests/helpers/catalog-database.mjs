// Explicit persisted fixture catalogs; production never seeds these documents.
import {memoryDatabase} from './memory-database.mjs';
import {defaultPack} from '../../src/catalog-model.js';
export function catalogDatabase(){return memoryDatabase(['basic','plus','premium','elite','ultimate'].map(id=>['packContents/'+id,{...defaultPack(id),version:1}]))}
