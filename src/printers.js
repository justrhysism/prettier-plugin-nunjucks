/**
 * Nunjucks Prettier Printers
 */

const {
  breakParent,
  concat,
  join,
  line,
  lineSuffix,
  group,
  conditionalGroup,
  indent,
  dedent,
  ifBreak,
  hardline,
  softline,
  literalline,
  align,
  dedentToRoot
} = require("prettier").doc.builders;
const { mapDoc } = require("prettier").doc.utils;

let hoistedTextToDoc;

let placeholderIncrement = 0;

function getPlaceholderTags(acc) {
  const placeholder = `Placeholder-${placeholderIncrement}`;
  placeholderIncrement++;

  const lastTagStartChar = acc.lastIndexOf("<");
  const lastTagEndChar = acc.lastIndexOf(">");
  const withinTag = lastTagStartChar > lastTagEndChar;
  const selfClosingPlaceholder = false;

  const tagOpenStartChar = withinTag ? "o-" : "\n<";
  const tagOpenEndChar = withinTag
    ? " "
    : selfClosingPlaceholder
    ? "/>\n"
    : ">\n";
  const tagCloseStartChar = withinTag ? "c-" : `\n</`;

  return {
    openTag: `${tagOpenStartChar}${placeholder}${tagOpenEndChar}`,
    closingTag: selfClosingPlaceholder
      ? ""
      : `${tagCloseStartChar}${placeholder}${tagOpenEndChar}`
  };
}

function print(path, options, print) {
  const node = path.getValue();

  // 1. Need to find all Nunjucks nodes and replace them with placeholders
  // 2. Run the place-held doc through the HTML formatter
  // 3. Upon return, re-instate the Nunjucks template tags with formatting

  const PLACEHOLDER_REGEX = /Placeholder-\d+/;
  const placeholderMap = new Map();

  function tempExtractTemplateData(acc, node) {
    if (node.type === "TemplateData") {
      return acc + node.value;
    }

    if (node.children) {
      return node.children.reduce(tempExtractTemplateData, acc);
    }

    const { openTag, closingTag } = getPlaceholderTags(acc);
    let printOpen = "";
    let printClose = "";

    acc += openTag;

    // TODO Split out elsewhere
    // Handle Printing
    switch (node.type) {
      case "If":
        printOpen = `{% if ${node.cond.value} %}`;
        printClose = "{% endif %}";
        break;
      case "For":
        let keys = node.name.value;

        if (node.name.children) {
          keys = node.name.children.map(item => item.value).join(", ");
        }

        printOpen = `{% for ${keys} in ${node.arr.value} %}`;
        printClose = "{% endfor %}";
        break;
    }

    placeholderMap.set(openTag.trim(), printOpen);

    if (closingTag.trim()) {
      placeholderMap.set(closingTag.trim(), printClose);
    }

    if (node.body && node.body.children) {
      // TODO: This reducer doesn't work inside a tag - renders tags within
      acc = node.body.children.reduce(tempExtractTemplateData, acc);
    }

    acc += closingTag;

    if (node.else_ && node.else_.children) {
      const elseTags = getPlaceholderTags(acc);
      const elseOpenTag = elseTags.openTag;
      const elseClosingTag = elseTags.closingTag;

      placeholderMap.set(elseOpenTag.trim(), "");
      if (closingTag.trim()) {
        const originalClosing = placeholderMap.get(closingTag.trim());
        placeholderMap.set(elseClosingTag.trim(), originalClosing);
        placeholderMap.set(closingTag.trim(), "{% else %}");
      }

      acc += `${elseOpenTag}${node.else_.children.reduce(
        tempExtractTemplateData,
        ""
      )}${elseClosingTag}`;
    }

    return acc;
  }

  // 1. Install placeholders
  const placeheldString = node.children.reduce(tempExtractTemplateData, "");

  // 2. Run through HTML formatter
  const htmlDoc = hoistedTextToDoc(placeheldString, { parser: "html" });

  const map = mapDoc(htmlDoc, currentDoc => {
    if (!currentDoc.parts) {
      return currentDoc;
    }

    const parts = [];

    currentDoc.parts.forEach(part => {
      const partIsString = typeof part === "string";
      const partIsPlaceholder = partIsString && PLACEHOLDER_REGEX.test(part);

      if (partIsPlaceholder) {
        const original = placeholderMap.get(part);

        if (original || original === "") {
          parts.push(original);
          return;
        }

        console.warn("Unable to find original for placeholder:", part);
      }

      const partIsObject = typeof part === "object";
      const contentsIsString =
        partIsObject && typeof part.contents === "string";
      const contentsIsPlaceholder =
        contentsIsString && PLACEHOLDER_REGEX.test(part.contents);

      if (contentsIsPlaceholder) {
        const original = placeholderMap.get(part.contents);

        if (original || original === "") {
          parts.push(Object.assign({}, part, { contents: original }));
          return;
        }

        console.warn("Unable to find original for placeholder:", part.contents);
      }

      parts.push(part);
    });

    return Object.assign({}, currentDoc, { parts });
  });

  return map;
}

function embed(path, print, textToDoc, options) {
  hoistedTextToDoc = textToDoc;
  return null;
}

module.exports = {
  "nunjucks-ast": {
    print,
    embed
  }
};
