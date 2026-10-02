// One server clock for expiry decisions; tests replace now without waiting in real time.
export const clock = { now: () => Date.now() };
