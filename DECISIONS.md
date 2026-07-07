## OTP Expiry Behaviour

When an OTP expires, the delivery rolls back to `IDENTIFIED` so the courier can request a fresh code rather than failing permanently. 3 minutes is too tight in real field conditions — poor signal, slow receivers. Security is still enforced through the 3-wrong-attempt limit, not the expiry alone.

## Part D — Duress PIN + GPS Delivery Proof

Each receiver gets a `duressOffset` at enrollment. When an OTP is generated, the backend computes and hashes two codes: the real OTP and `(realOtp + duressOffset) % 1000000`. Both paths return an identical 200 response — but the duress path silently inserts into `duress_alerts` and writes a `DURESS_TRIGGERED` audit event.

On successful verification (real or duress), the frontend captures the device's GPS coordinates via `navigator.geolocation` and sends them with the request. The backend stores `deliveredLatitude` and `deliveredLongitude` on the invoice and includes the coords in the `DELIVERY_COMPLETED` history event. For duress, the coordinates are also stored in `duress_alerts` so ops can dispatch to the exact location.

This covers two domain needs: proof of delivery location for the audit trail, and emergency response coordinates if coercion is detected.

For production: async alert dispatch to prevent timing-based detection, encrypted offset storage, and a native app that derives the duress OTP client-side without transmitting it.
