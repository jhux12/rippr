export const MANUAL_SHIPPING_ACTIONS=['checkoutShipment','validateShippingAddress','estimateShipment','shippingState','quoteShipment','payShipment','cancelShipment','adminShippingLabel','adminRefundShippingFee','adminBuyShippingLabel','adminRefreshShippingLabel','adminReconcileShippingVoid','syncTracking','adminSyncTracking'];
export function cleanManualRates(rates=[]){
 if(!Array.isArray(rates)||rates.length>20)throw Error('Add up to 20 weight brackets.');let previous=0;
 return rates.map(r=>{if(!Number.isFinite(r.maxOz)||r.maxOz<=previous||r.maxOz>1024||!Number.isSafeInteger(r.amountCents)||r.amountCents<1||r.amountCents>100000)throw Error('Weight limits must increase; prices must be $0.01–$1,000.');previous=r.maxOz;return{maxOz:r.maxOz,amountCents:r.amountCents}});
}
export function manualShippingRate(config,parcel){
 const weight=Number(parcel.weight),tier=config.manualRates.find(r=>weight<=r.maxOz);if(!Number.isFinite(weight)||weight<=0||!tier)throw Error('This parcel needs a manual shipping quote. Contact support.');
 return{rates:[{id:'manual-weight-v'+(config.version||1)+'-'+String(tier.maxOz).replace('.','-'),carrier:'rippr',service:'Standard tracked shipping',serviceToken:'manual_tracked',amountCents:tier.amountCents,source:'manual'}]};
}
