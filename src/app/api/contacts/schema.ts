import { z } from "zod";

export const ContactBody = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().pipe(z.email("Invalid email")),
  roles: z
    .array(z.string())
    .default([])
    .transform((rs) => [...new Set(rs.map((r) => r.trim().toLowerCase()).filter(Boolean))]),
  notes: z.string().default(""),
});
