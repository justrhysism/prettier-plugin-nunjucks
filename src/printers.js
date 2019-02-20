/**
 * Nunjucks Prettier Printers
 */

const { printVariable } = require("./printer/variables");
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

const SELF_CLOSING_TYPES = ["FunCall", "LookupVal", "Set", "Symbol"];
const PLACEHOLDER_REGEX = /Placeholder-\d+/;
let hoistedTextToDoc;

let placeholderIncrement = 0;

function getPlaceholderTags(acc, selfClosing) {
  placeholderIncrement++;
  const placeholder = `Placeholder-${placeholderIncrement}`;

  const lastTagStartChar = acc.lastIndexOf("<");
  const lastTagEndChar = acc.lastIndexOf(">");
  const withinTag = lastTagStartChar > lastTagEndChar;

  const tagOpenStartChar = withinTag ? "o-" : selfClosing ? "<" : "\n<";
  const tagOpenEndChar = withinTag ? " " : selfClosing ? "/> " : ">\n";
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

  const placeholderMap = new Map();

  function tempExtractTemplateData(acc, node) {
    if (node.type === "TemplateData") {
      return acc + node.value;
    }

    if (node.children) {
      return node.children.reduce(tempExtractTemplateData, acc);
    }

    let selfClosing = SELF_CLOSING_TYPES.some(type => type === node.type);
    const { openTag, openTagKey, closingTag, withinTag } = getPlaceholderTags(
      acc,
      selfClosing
    );
    let printOpen = "";
    let printClose = "";
    let hasElse = !!(node.else_ && node.else_.children);

    // TODO Split out elsewhere
    // Handle Printing
    switch (node.type) {
      case "Block":
        printOpen = `{% block ${node.name.value} %}`;
        printClose = "{% endblock %}";
        break;
      case "If":
        printOpen = `{% if ${node.cond.value} %}`;
        printClose = "{% endif %}";
        break;
      case "For":
      case "AsyncAll":
      case "AsyncEach":
        let forOpen = "for";
        let forClose = "endfor";

        switch (node.type) {
          case "AsyncAll":
            forOpen = "asyncAll";
            forClose = "endall";
            break;
          case "AsyncEach":
            forOpen = "asyncEach";
            forClose = "endeach";
            break;
        }

        let keys = node.name.value;

        if (node.name.children) {
          keys = node.name.children.map(item => item.value).join(", ");
        }

        printOpen = `{% ${forOpen} ${keys} in ${node.arr.value} %}`;
        printClose = `{% ${forClose} %}`;
        break;
      case "Symbol":
      case "LookupVal":
        printOpen = printVariable(node);
        break;
      case "FunCall":
        printOpen = `{{ ${node.name.value}() }}`;
        break;
    }

    if (printOpen) {
      acc += openTag;
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

      acc += elseOpenTag;
      acc = node.else_.children.reduce(tempExtractTemplateData, acc);
    }

    if (printClose) {
      acc += closingTag;
    }

    return acc;
  }

  // 1. Install placeholders
  const placeheldString = node.children.reduce(tempExtractTemplateData, "");
  // console.log("###");
  // console.log(placeheldString);
  // console.log("###");

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
            placeholderMap.delete(part);
            placeholderMap.delete(part.replace(">", ""));
            parts.push(original.print);
            return;
          } else {
            let found = false;

            // Potentially the placeholder is buried within a string
            for (let [key, value] of placeholderMap) {
              if (part.includes(key)) {
                const replaced = part.replace(key, value.print);
                parts.push(replaced);
                found = true;
                break;
              }
            }

            if (found) return;
          }

          console.warn("Unable to find original for placeholder:", part);
          return;
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
            placeholderMap.delete(part.contents);
            placeholderMap.delete(part.contents.replace(">", ""));
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
                    // TODO: Use function getSelfClosingPlaceholder()
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

        // The whole array could be self-closing part
        const selfClosingPlaceholder = getSelfClosingPlaceholder(
          {
            parts: arr
          },
          placeholderMap
        );

        if (selfClosingPlaceholder && selfClosingPlaceholder.type !== "else") {
          parts.push(selfClosingPlaceholder.print);

          if (arr[nextIndex] === "/>") {
            arr[nextIndex] = "";
          }

          return;
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

function isSelfClosingPlaceholder(arr) {
  if (!Array.isArray(arr) || !arr.length) return false;

  const isOpeningGroup = arr[0].type === "group";
  const isSelfClosing = arr[1] === "/>";
  if (!isOpeningGroup || !isSelfClosing) return;

  return PLACEHOLDER_REGEX.test(arr[0].contents.contents);
}

function getSelfClosingPlaceholder(doc, placeholderMap) {
  if (typeof doc !== "object") return;

  const parts = doc.parts;

  if (!parts) return;

  const isPlaceholder = isSelfClosingPlaceholder(parts);
  if (!isPlaceholder) return;

  const placeholder = parts[0].contents.contents.trim();
  return placeholderMap.get(placeholder);
}

module.exports = {
  "nunjucks-ast": {
    print,
    embed
  }
};
