import "@testing-library/jest-dom/vitest"

// jsdom doesn't implement scrollIntoView; components (e.g. ImageViewer) call
// it in a useEffect, which would otherwise throw in every component test.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

// jsdom doesn't implement these either; the reply composer's image-attachment
// preview (MessagesTriagePage.tsx) calls them when staging/removing a file.
if (typeof URL !== "undefined" && !URL.createObjectURL) {
  URL.createObjectURL = () => "blob:mock-preview-url"
  URL.revokeObjectURL = () => {}
}
