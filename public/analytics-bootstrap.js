// GA4 bootstrap. A file rather than an inline block, so the Content-Security-Policy in
// public/_headers does not have to allow 'unsafe-inline' scripts. Loaded without defer
// so window.gtag exists before the module bundle runs.
//
// send_page_view is off, and the Umami tag sets data-auto-track="false", because this is
// a pushState SPA: src/analytics.ts sends one page view per route change instead. The
// reasoning is at the top of that file.
window.dataLayer = window.dataLayer || [];
function gtag() {
  dataLayer.push(arguments);
}
gtag("js", new Date());
gtag("config", "G-BXL0V8163H", { send_page_view: false });
