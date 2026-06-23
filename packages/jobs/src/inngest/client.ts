import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "carbon" });
export type InngestClient = typeof inngest;
