// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { collectContext, columnHeaderText, sectionHeadingText, snippetAround, textBefore } from "../src/core/context";

function setup(html: string): Document {
  document.documentElement.innerHTML = `<head></head><body>${html}</body>`;
  return document;
}

/** The text node containing `needle`, and the offset of `needle` in it. */
function locate(needle: string): [Text, number] {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const i = (n as Text).data.indexOf(needle);
    if (i >= 0) return [n as Text, i];
  }
  throw new Error(`not found: ${needle}`);
}

describe("textBefore", () => {
  it("crosses inline elements but stays in the block", () => {
    setup("<p>Other block</p><p>The <b>assignment</b> is <i>due by</i> 2026-11-12.</p>");
    const [node, offset] = locate("2026-11-12");
    expect(textBefore(node, offset, 40)).toBe("The assignment is due by ");
    expect(textBefore(node, offset, 7)).toBe("due by ");
  });

  it("ignores script text", () => {
    setup("<p>Due<script>var x = 1;</script> on 2026-11-12</p>");
    const [node, offset] = locate("2026-11-12");
    expect(textBefore(node, offset, 40)).toBe("Due on ");
  });
});

describe("snippetAround", () => {
  it("shows about 15 characters on each side", () => {
    setup("<p>This is a fairly long sentence with 2026-11-12 in the   middle of more words here.</p>");
    const [node, offset] = locate("2026-11-12");
    expect(snippetAround(node, offset, 10)).toBe("… sentence with 2026-11-12 in the middle …");
  });
});

describe("columnHeaderText", () => {
  it("accounts for colspan", () => {
    setup(`<table>
      <thead><tr><th colspan="2">Who</th><th>Uploaded</th><th>Due</th></tr></thead>
      <tbody><tr><td>1</td><td>Ann</td><td>Oct 11, 2026</td><td><span>Oct 20, 2026</span></td></tr></tbody>
    </table>`);
    expect(columnHeaderText(locate("Oct 11")[0])).toBe("Uploaded");
    expect(columnHeaderText(locate("Oct 20")[0])).toBe("Due");
    expect(columnHeaderText(locate("Ann")[0])).toBe("Who");
  });

  it("uses a first row of th cells when there is no thead", () => {
    setup(`<table><tr><th>Student</th><th>Uploaded</th></tr><tr><td>72182780</td><td>Oct 11, 2026</td></tr></table>`);
    expect(columnHeaderText(locate("Oct 11")[0])).toBe("Uploaded");
    expect(columnHeaderText(locate("72182780")[0])).toBe("Student");
  });

  it("supports ARIA grids", () => {
    setup(`<div role="grid">
      <div role="row"><span role="columnheader">Name</span><span role="columnheader">Deadline</span></div>
      <div role="row"><span role="gridcell">Ann</span><span role="gridcell">Nov 12</span></div>
    </div>`);
    expect(columnHeaderText(locate("Nov 12")[0])).toBe("Deadline");
  });

  it("is null outside tables and for header cells themselves", () => {
    setup(`<p>Nov 12</p><table><tr><th>Due</th></tr></table>`);
    expect(columnHeaderText(locate("Nov 12")[0])).toBeNull();
    expect(columnHeaderText(locate("Due")[0])).toBeNull();
  });
});

describe("sectionHeadingText", () => {
  it("picks the nearest preceding heading and ignores later ones", () => {
    setup(`<h1>Page</h1><h2>First table</h2><p>A 2026-11-01</p><h2>Second table</h2><div><p>B 2026-11-02</p></div><h3>Later</h3>`);
    const headings = document.querySelectorAll("h1,h2,h3,h4");
    expect(sectionHeadingText(locate("A 2026")[0], headings)).toBe("First table");
    expect(sectionHeadingText(locate("B 2026")[0], headings)).toBe("Second table");
  });

  it("is null before the first heading", () => {
    setup(`<p>Early</p><h2>Heading</h2>`);
    expect(sectionHeadingText(locate("Early")[0], document.querySelectorAll("h1,h2,h3,h4"))).toBeNull();
  });
});

describe("collectContext", () => {
  it("leaves switched-off parts null", () => {
    setup(`<h2>Queue</h2><table><tr><th>Uploaded</th></tr><tr><td>Oct 11, 2026</td></tr></table>`);
    const [node, offset] = locate("Oct 11");
    const headings = document.querySelectorAll("h1,h2,h3,h4");
    expect(collectContext(node, offset, 12, { before: true, columnHeader: false, sectionHeading: true }, 40, headings)).toEqual({
      before: "",
      columnHeader: null,
      sectionHeading: "Queue",
      snippet: "Oct 11, 2026",
    });
  });
});
