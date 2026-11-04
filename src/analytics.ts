// GA4 and Umami. Both tags are loaded from index.html with their own automatic page
// view turned off, because this is a pushState SPA and neither default is right here:
// GA4 would file every /game/<id> under "/", and Umami's auto-tracking fires on
// replaceState, which the filter effect calls on every keystroke in the search box.
// So page views are sent from App, once per route change, after document.title is set.
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    umami?: { track: (name?: string, data?: Record<string, unknown>) => void };
  }
}

export function trackPageView() {
  window.gtag?.("event", "page_view", {
    page_location: location.href,
    page_title: document.title,
  });
  window.umami?.track();
}

// One delegated listener instead of a handler on each of the ten outbound anchors.
// Clicks through to Hacker News are the point of the site, so they are the metric
// worth having; same-origin hrefs are internal routes and the catalog download.
export function listenForOutboundClicks() {
  const onClick = (event: MouseEvent) => {
    const anchor = (event.target as Element | null)?.closest?.("a");
    const href = anchor?.getAttribute("href");
    if (!href) return;
    let url: URL;
    try {
      url = new URL(href, location.href);
    } catch {
      return;
    }
    if (url.origin === location.origin) return;
    window.gtag?.("event", "click", {
      link_url: url.href,
      link_domain: url.hostname,
      link_text: (anchor!.textContent || "").trim().slice(0, 80),
      outbound: true,
    });
    window.umami?.track("outbound-click", {
      host: url.hostname,
      url: url.href,
      from: location.pathname,
    });
  };
  document.addEventListener("click", onClick, true);
  document.addEventListener("auxclick", onClick, true);
  return () => {
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("auxclick", onClick, true);
  };
}
