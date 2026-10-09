'use strict';
/* Placeholders for systems that are filled in later in the build. Each one is replaced by its own file; any
   method that is not listed here does nothing. */
const NOOP = () => undefined;
const stub = o => new Proxy(o, { get: (t, k) => (k in t ? t[k] : typeof k === 'string' ? NOOP : undefined) });
const Advancements = stub({ page() { return '<div class="mtitle">Advancements</div><div class="mhint big">Coming soon</div><div class="mbottom"><div class="mbtn" data-act="pause">Done</div></div>'; } });
const Decor = stub({});
const Fishing = stub({});
const Maps = stub({});
const Leads = stub({});
const Signs = stub({});
