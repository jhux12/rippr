import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { defineBoolean } from 'firebase-functions/params';
import { accountService } from './service.js';
import { museumService } from './museum-service.js';
initializeApp();
const freeTestTopups = defineBoolean('FREE_TEST_TOPUPS', { default:true, description:'Allow free, nonredeemable test credit. Disable to pause top-ups.' });
const operate = accountService(getFirestore(), { freeTopups:()=>freeTestTopups.value() });
export const ripprAccount = onCall({ region:'us-central1', maxInstances:10, timeoutSeconds:30 }, request => operate(request.auth?.uid, request.data, request.auth?.token));

const museumOperate = museumService(getFirestore());
export const ripprMuseum = onCall({ region:'us-central1', maxInstances:10, timeoutSeconds:30 }, request => museumOperate(request.auth?.uid, request.data));
