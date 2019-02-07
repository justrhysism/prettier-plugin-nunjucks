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

function getPlaceholderTags(acc, selfClosing) {
  const placeholder = `Placeholder-${placeholderIncrement}`;
  placeholderIncrement++;

  const lastTagStartChar = acc.lastIndexOf("<");
  const lastTagEndChar = acc.lastIndexOf(">");
  const withinTag = lastTagStartChar > lastTagEndChar;

  const tagOpenStartChar = withinTag ? "o-" : "\n<";
  const tagOpenEndChar = withinTag ? " " : selfClosing ? "/>\n" : ">\n";
  const tagCloseStartChar = withinTag ? "c-" : `\n</`;

  return {
    openTag: `${tagOpenStartChar}${placeholder}${tagOpenEndChar}`,
    openTagKey: `${tagOpenStartChar}${placeholder}`.trim(),
    closingTag: selfClosing
      ? ""
      : `${tagCloseStartChar}${placeholder}${tagOpenEndChar}`,
    withinTag
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

    const { openTag, openTagKey, closingTag, withinTag } = getPlaceholderTags(
      acc
    );
    let printOpen = "";
    let printClose = "";
    let hasElse = !!(node.else_ && node.else_.children);

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

    placeholderMap.set(openTagKey, {
      tagType: "open",
      type: node.type,
      print: printOpen,
      withinTag,
      hasElse
    });

    if (closingTag.trim()) {
      placeholderMap.set(closingTag.trim(), {
        tagType: "close",
        type: node.type,
        print: printClose,
        withinTag
      });
    }

    if (node.body && node.body.children) {
      // TODO: This reducer doesn't work inside a tag - renders tags within
      acc = node.body.children.reduce(tempExtractTemplateData, acc);
    }

    if (node.else_ && node.else_.children) {
      const elseTags = getPlaceholderTags(acc, true);
      const elseOpenTag = elseTags.openTag;
      const elseOpenTagKey = elseTags.openTagKey;

      placeholderMap.set(elseOpenTagKey, {
        tagType: "single",
        type: "else",
        print: "{% else %}",
        withinTag
      });

      acc += `${elseOpenTag}${node.else_.children.reduce(
        tempExtractTemplateData,
        ""
      )}`;
    }

    acc += closingTag;

    return acc;
  }

  // 1. Install placeholders
  const placeheldString = node.children.reduce(tempExtractTemplateData, "");

  // 2. Run through HTML formatter
  const htmlDoc = hoistedTextToDoc(placeheldString, { parser: "html" });

  const map = mapDoc(
    htmlDoc,
    currentDoc => {
      if (!currentDoc.parts) {
        return currentDoc;
      }

      const parts = [];

      currentDoc.parts.forEach((part, index, arr) => {
        const partIsString = typeof part === "string";
        const partIsPlaceholder = partIsString && PLACEHOLDER_REGEX.test(part);
        const nextIndex = index + 1;

        if (partIsPlaceholder) {
          const original =
            placeholderMap.get(part) ||
            placeholderMap.get(part.replace(">", ""));

          if (original) {
            parts.push(original.print);
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
          const original =
            placeholderMap.get(part.contents) ||
            placeholderMap.get(part.contents.replace(">", ""));

          if (original) {
            parts.push(Object.assign({}, part, { contents: original.print }));

            if (original.hasElse) {
              /*
              So, we need to look ahead to replace the placeholder for the else
              This should look like:
              contents: {
                parts: [
                  { ...contents: { ...contents: '<Placeholder-N' <-- THEN THIS } },
                  '/>' <-- LOOK FOR THIS FIRST
                ]
              }
              */

              const remainingParts = arr.slice(nextIndex);

              function elsePlaceholderReplacer(part) {
                // Start fast bail
                if (typeof part !== "object") return false;

                switch (part.type) {
                  case "line":
                  case "break-parent":
                    return false;
                }
                // End fast bail

                // Look for "/>"
                if (typeof part.contents === "object") {
                  const childParts = part.contents.parts;

                  if (childParts) {
                    // Will be the last item of the group
                    if (childParts[childParts.length - 1] === "/>") {
                      return childParts.find(childPart => {
                        if (
                          PLACEHOLDER_REGEX.test(childPart.contents.contents)
                        ) {
                          const placeholder = childPart.contents.contents.trim();
                          const elseReplacementModel = placeholderMap.get(
                            placeholder
                          );

                          if (elseReplacementModel) {
                            part.contents = dedent(
                              concat([
                                hardline,
                                elseReplacementModel.print
                                // hardline
                              ])
                            );

                            return true;
                          }

                          return false;
                        }
                      });
                    }

                    const elseIndex = childParts.findIndex(
                      elsePlaceholderReplacer
                    );
                    if (elseIndex === -1) return false;

                    // If we've found else, we'll need to clean out the extra lines
                    // TODO: Split out function to helper
                    function isLine(part) {
                      if (typeof part !== "object") return false;

                      switch (part.type) {
                        case "line":
                        case "break-parent":
                          return true;
                        default:
                          return false;
                      }
                    }

                    if (elseIndex === -1) return true;

                    // Clear backwards
                    for (let i = elseIndex - 1; i > -1; i--) {
                      const childPart = childParts[i];
                      if (isLine(childPart)) {
                        childParts[i] = "";
                      } else {
                        break;
                      }
                    }

                    // Clear Forwards
                    for (let i = elseIndex + 1; i < childParts.length; i++) {
                      const childPart = childParts[i];
                      if (isLine(childPart)) {
                        childParts[i] = "";
                      } else {
                        if (childParts[i] && childParts[i].type === "group") {
                          childParts[i] = concat([hardline, childParts[i]]);
                        }
                        break;
                      }
                    }

                    return true;
                  }

                  // Case contents.contents.parts
                  return elsePlaceholderReplacer(part.contents);
                }

                return false;
              }

              // Using find so we can bail when we're done
              remainingParts.find(elsePlaceholderReplacer);
            }

            return;
          }

          console.warn(
            "Unable to find original for placeholder:",
            part.contents
          );
        }

        parts.push(part);
      });

      return Object.assign({}, currentDoc, { parts });
    },
    htmlDoc
  );

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
