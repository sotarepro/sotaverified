import NextLink from "next/link";
import type { ComponentProps } from "react";

/**
 * next/link with viewport prefetching OFF by default. In production every visible <Link>
 * otherwise fires several `?_rsc=` prefetch requests per page view; for a mostly-static
 * site visited by JS-executing scrapers that multiplies CDN requests 10-50x. Pass
 * `prefetch` explicitly to opt back in.
 */
export default function Link({ prefetch = false, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={prefetch} {...props} />;
}
