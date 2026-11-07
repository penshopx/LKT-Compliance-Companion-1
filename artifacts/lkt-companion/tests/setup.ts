import { vi } from "vitest";

// jsdom has no layout/scroll implementation; all data and query behavior is real.
Element.prototype.scrollIntoView = vi.fn();
