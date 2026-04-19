export type RouteTable = Record<string, readonly string[]>;

export type RouteHandler = {
  routes: readonly string[];
  run: () => void;
};

/**
 * Normalize a PPM page URL to a route key like "/lv/speletajs" or "/en/player".
 * Strips the .html suffix because route tables store only the logical page slug.
 */
export function extractPpmRoute(url: string): string | null {
  try {
    const pathname = new URL(url).pathname.replace(/\.html$/, "");
    const match = pathname.match(/^\/[\w-]+\/[\w-]+$/);
    return match ? match[0] : null;
  } catch {
    return null;
  }
}

export function dispatchRoute(url: string, handlers: RouteHandler[]): boolean {
  const route = extractPpmRoute(url);

  if (!route) {
    return false;
  }

  for (const handler of handlers) {
    if (handler.routes.includes(route)) {
      handler.run();
      return true;
    }
  }

  return false;
}

export function getLocalizedPageForLang(
  routes: readonly string[],
  lang: string,
  fallback: string
): string {
  const route = routes.find((candidate) => candidate.startsWith(`/${lang}/`));
  return route ? `${route.split("/").pop()}.html` : fallback;
}
