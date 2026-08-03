import "@testing-library/jest-dom/vitest"

// jsdom doesn't implement scrollIntoView; components (e.g. ImageViewer) call
// it in a useEffect, which would otherwise throw in every component test.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
