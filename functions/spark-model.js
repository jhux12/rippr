import {validateRewards,cleanPrizes} from './reward-model.js';
export const SPARK_SPIN_UNITS=2500; // 100 units = 1 point; 1 eligible USD cent = 1 unit.
export const defaultSpark=()=>({enabled:true,version:0,prizes:[{id:'spark-5',kind:'credit',amountCents:5,chanceBps:8000},{id:'spark-10',kind:'credit',amountCents:10,chanceBps:1800},{id:'spark-25',kind:'credit',amountCents:25,chanceBps:200}]});
export function readSpark(data){const errors=validateRewards(data);if(errors.length||!Number.isInteger(data.version)||data.version<1)throw Error(errors[0]||'Spark settings version is invalid.');return{enabled:data.enabled,version:data.version,prizes:cleanPrizes(data.prizes)}}
export function sparkBalance(wallet={}){const fields=['sparkUnits','sparkEarnedUnits','sparkSpentUnits','sparkRevokedUnits','sparkDebtUnits','sparkRevision'];for(const key of fields)if(wallet[key]!==undefined&&(!Number.isSafeInteger(wallet[key])||wallet[key]<0||wallet[key]>1e12))throw Error('Spark Points need reconciliation. Contact support.');return Object.fromEntries(fields.map(key=>[key,wallet[key]||0]))}
export const formatSpark=units=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(units/100);
