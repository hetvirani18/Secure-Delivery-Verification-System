## OTP Expiry Behaviour

When an OTP expires, the delivery rolls back to `IDENTIFIED` so the courier can request a fresh code rather than failing permanently. 3 minutes is too tight in real field conditions — poor signal, slow receivers. Security is still enforced through the 3-wrong-attempt limit, not the expiry alone.

## Part D — Duress PIN Silent Alarm

Each receiver gets a `duressOffset` at enrollment. When an OTP is generated, the backend computes and hashes two codes: the real OTP and `(realOtp + duressOffset) % 1000000`. Both paths return an identical 200 response — but the duress path silently inserts into `duress_alerts` and writes a `DURESS_TRIGGERED` audit event.

This targets the most dangerous edge case in precious metals logistics: coercion. A receiver under threat complies normally while ops is silently alerted. An attacker sees an identical 6-digit code either way.

For production: async alert dispatch to prevent timing-based detection, encrypted offset storage, and a native app that derives the duress OTP client-side without transmitting it.
