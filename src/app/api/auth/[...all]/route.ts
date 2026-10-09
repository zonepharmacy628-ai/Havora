import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Better Auth's HTTP endpoints. The app signs users in through server actions,
// but emailed links (e.g. password reset) land on these routes.
export const { GET, POST } = toNextJsHandler(auth);
