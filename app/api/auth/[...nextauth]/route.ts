import { handlers } from "@/auth";

// Force Node.js runtime — postgres-js uses TCP sockets which are not
// available in Edge runtime, causing AdapterError on every DB query.
export const runtime = "nodejs";

export const { GET, POST } = handlers;
