/**
 * Restore Functions
 */

const {
  breakParent,
  concat,
  indent,
  dedent,
  softline,
  hardline,
  group
} = require("prettier").doc.builders;
const { PLACEHOLDER_REGEX } = require("./placeholders");
const { isBuilderLine } = require("./helpers");

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

function printWithinElement(arr, placeholderMap) {
  // Find "blocks" and indent contents. Remember to support nested.
  const parts = [];
  let index = -1;

  for (const part of arr) {
    index++;

    // Only care about placeholder strings
    if (typeof part !== "string" || !isWithinElementPlaceholder(part)) {
      parts.push(part);
      continue;
    }

    const original = findOriginal(part, placeholderMap);

    if (original) {
      if (original.tagType === 1 || original.tagType === 3) {
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

        const indentGroup = arr.splice(index + 1, captureCount).map(item =>
          // Change all softlines to hardlines
          typeof item === "object" && item.type === "line" ? hardline : item
        );

        const lastGroupItem = indentGroup[indentGroup.length - 1];
        let closeGroup = hardline;

        // Remove end placeholder if it's a fork
        if (lastGroupItem === endPlaceholder) {
          const originalLastGroupItem = findOriginal(
            lastGroupItem,
            placeholderMap
          );

          if (originalLastGroupItem.isFork) {
            indentGroup.pop(); // Empty tag
            indentGroup.pop(); // Extra line
          } else if (originalLastGroupItem.tagType === 2) {
            indentGroup.pop(); // End tag
            indentGroup.pop(); // Extra line
            closeGroup = concat([hardline, originalLastGroupItem.print]);
          }
        }

        // Indent group
        const doc = concat([
          group(
            indent(concat(printWithinElement(indentGroup, placeholderMap)))
          ),
          closeGroup
        ]);

        // Remove extra line
        let deleteCount = 0;
        if (isBuilderLine(arr[index + 1])) {
          deleteCount = 1;
        }

        arr.splice(index + 1, deleteCount, doc);
        continue;
      }
    }

    // Fallback to doing nothing
    parts.push(part);
  }

  return parts;
}

function mapRestoreTags(placeholderMap) {
  return function(doc) {
    if (!doc.parts) {
      return doc;
    }

    const arr = [...doc.parts];

    // Markup within an element?
    const isWithinElement = arr.some(part =>
      typeof part === "string" ? isWithinElementPlaceholder(part) : false
    );

    const parts = [];
    if (isWithinElement) {
      parts.push(...printWithinElement(arr, placeholderMap));
    } else {
      let index = -1;

      for (const part of arr) {
        index++;
        const original = findOriginal(part, placeholderMap);

        // These are usually within elements
        if (original) {
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

        parts.push(part);
      }

      if (parts.some(part => part === undefined)) {
        throw Error("Cannot have undefined parts");
      }
    }

    return Object.assign({}, doc, { parts });
  };
}

module.exports = {
  mapRestoreTags
};
