/**
 * Nunjucks Prettier Printers
 */

"use strict";

const { printVariable } = require("./printer/variables");
const {
  isBlockTag,
  hasElse,
  getOpenTagName,
  getCloseTagName,
  getValue,
  isBuilderLine
} = require("./printer/helpers");
//
const { concat, dedent, hardline } = require("prettier").doc.builders;
const { mapDoc } = require("prettier").doc.utils;
//
// const TAG_OPEN = "{%";
// const TAG_CLOSE = "%}";
const PLACEHOLDER_REGEX = /p\d+/;

let hoistedTextToDoc;

// args: path, options, print
function print(path) {
  const parsedArray = path.stack[0];
  // 1. Need to find all Nunjucks nodes and replace them with placeholders
  // 2. Run the place-held doc through the HTML formatter
  // 3. Upon return, re-instate the Nunjucks template tags with formatting

  const placeholderMap = new Map();

  // 1. Install placeholders
  const placeheldString = parsedArray.reduce((acc, token) => {
    const { type, value, key, placeholder, isFork, withinElement } = token;

    if (type === "tag") {
      placeholderMap.set(key, token);

      if (isFork) {
        const forkElement = placeholder.trim().split(' ')[1];
        const forkKey = forkElement.replace('>', '');
        placeholderMap.set(forkKey, {
          print: '',
          isFork
        });
      } else {}


      return acc + placeholder;
    }

    return acc + value;
  }, "");
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

            if (original.print !== '') {
              parts.push(original.print);
            } else if (original.isFork) {
              // Remove extra line
              const nextPart = arr[index + 1];
              if (nextPart && nextPart.type === 'break-parent' || nextPart.type === 'line') {
                arr.splice(index + 1, 1);
              }
            }

            return;
          }

          let found = false;

          // Potentially the placeholder is buried within a string
          for (const [key, value] of placeholderMap) {
            if (part.includes(key)) {
              const replaced = part.replace(key, value.print);
              parts.push(replaced);
              found = true;
              break;
            }
          }

          if (found) {
            return;
          }

          // eslint-disable-next-line no-console
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

            if (original.print !== '') {
              parts.push(Object.assign({}, part, { contents: original.print }));
            } else if (original.isFork) {
              // Remove extra line
              const nextPart = arr[index + 1];
              if (nextPart || nextPart.type === 'line') {
                arr.splice(index + 1, 1);
              } else if (nextPart  && nextPart.type === 'break-parent') {
                // TODO: Dig into the indent and remove the line at the top
              }
            }

            return;
          }

          // eslint-disable-next-line no-console
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

        if (selfClosingPlaceholder) {
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

// args: path, print, textToDoc, options
function embed(path, print, textToDoc) {
  hoistedTextToDoc = textToDoc;
  return null;
}

function isSelfClosingPlaceholder(arr) {
  if (!Array.isArray(arr) || !arr.length) {
    return false;
  }

  const isOpeningGroup = arr[0].type === "group";
  const isSelfClosing = arr[1] === "/>";

  if (!isOpeningGroup || !isSelfClosing) {
    return;
  }

  return PLACEHOLDER_REGEX.test(arr[0].contents.contents);
}

function getSelfClosingPlaceholder(doc, placeholderMap) {
  if (typeof doc !== "object") {
    return;
  }

  const { parts } = doc;

  if (!parts) {
    return;
  }

  const isPlaceholder = isSelfClosingPlaceholder(parts);
  if (!isPlaceholder) {
    return;
  }

  const placeholder = parts[0].contents.contents.trim();
  return placeholderMap.get(placeholder);
}

module.exports = {
  "nunjucks-ast": {
    print,
    embed
  }
};
