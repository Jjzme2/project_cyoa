import type { MetadataRoute } from "next";
import { APP_CONFIG } from "@/lib/config";

const BASE = APP_CONFIG.site.url.replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep authenticated / utility surfaces out of the index.
      disallow: ["/api/", "/dashboard", "/profile"],
    },
    sitemap: `${BASE}/sitemap.ts`,
    host: BASE,
  };
}
