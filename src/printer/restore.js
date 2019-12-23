/**
 * Restore Functions
 */


const {
  breakParent,
  concat,
  indent,
  dedent,
  softline,
  hardline
} = require("prettier").doc.builders;
const { PLACEHOLDER_REGEX } = require("./placeholders");
const {isBuilderLine} = require('./helpers');

function findKey(key, placeholderMap) {
  if (placeholderMap.has(key)) return key;

  const altKey = key.replace(">", "");
  if (placeholderMap.has(altKey)) return altKey;

  return undefined;
}

function findOriginal(part, placeholderMap) {
  let key = "";
  const partIsString = typeof part === "string";
  const partIsPlaceholder = partIsString && PLACEHOLDER_REGEX.test(part);

  if (partIsString && part === "") return;

  if (partIsPlaceholder) {
    key = findKey(part, placeholderMap);
  } else {
    // These are usually elements
    const partIsObject = typeof part === "object";
    const contentsIsString = partIsObject && typeof part.contents === "string";
    const contentsIsPlaceholder =
      contentsIsString && PLACEHOLDER_REGEX.test(part.contents);

    if (contentsIsPlaceholder) {
      key = findKey(part.contents, placeholderMap);
    }
  }

  if (!key) return;

  if (placeholderMap.has(key)) {
    const original = placeholderMap.get(key);
    placeholderMap.delete(key);
    return original;
  }

  // eslint-disable-next-line no-console
  // console.warn("Unable to find original for placeholder:", key);
}

const isWithinElementPlaceholder = part =>
  part.startsWith("o$") || part.startsWith("c$");

function mapRestoreTags(placeholderMap) {
  return function(doc) {
    if (!doc.parts) {
      return doc;
    }

    const arr = [...doc.parts];

    // Markup with an element?
    const isWithinElement = arr.some(part =>
      typeof part === "string" ? isWithinElementPlaceholder(part) : false
    );
    // const depthStack = [];

    const parts = [];

    let index = -1;

    for (const part of arr) {
      index++;
      const original = findOriginal(part, placeholderMap);

      // These are usually within elements
      if (original) {
        // If within an element, we need to manage the indentation of blocks
        if (isWithinElement && isWithinElementPlaceholder(part)) {
          // TODO: Use enum export for TAG_BLOCK
          if (original.tagType === 1) {
            parts.push(original.print);

            // Capture parts until end tag found
            const endPlaceholder = part.replace("o", "c");
            let found = false;
            let captureIndex = index;
            const maxIndex = arr.length;
            let captureCount = 0;

            while (!found && captureIndex < maxIndex) {
              captureIndex++;
              captureCount++;

              if (arr[captureIndex] === endPlaceholder) found = true;
            }

            const group = arr.splice(index + 1, captureCount);
            const lastGroupItem = group[group.length - 1];

            // Remove end placeholder
            if (lastGroupItem === endPlaceholder) group.pop();

            // Indent group
            const doc = indent(concat(group));

            // Remove extra line
            let deleteCount = 0;
            if (isBuilderLine(arr[index + 1])) arr[index + 1] = deleteCount = 1;

            arr.splice(index + 1, deleteCount, doc);
            continue;
          }
        }

        if (original.print !== "") {
          parts.push(original.print);
          continue;
        }

        if (original.isFork && original.print === "") {
          // If not within an element, end immediately to prevent excess blank lines
          if (!original.withinElement) break;
        }

        continue;
      }

      // The whole array could be self-closing part
      // const selfClosingPlaceholder = getSelfClosingPlaceholder(
      //   {
      //     parts: arr
      //   },
      //   placeholderMap
      // );
      //
      // if (selfClosingPlaceholder) {
      //   parts.push(selfClosingPlaceholder.print);
      //
      //   if (arr[nextIndex] === "/>") {
      //     arr[nextIndex] = "";
      //   }
      //
      //   break;
      // }

      parts.push(part);
    }

    if (parts.some(part => part === undefined)) {
      throw Error("Cannot have undefined parts");
    }

    return Object.assign({}, doc, { parts });
  };
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
  mapRestoreTags
};
