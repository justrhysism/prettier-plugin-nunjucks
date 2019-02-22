/**
 * Printer Helpers
 */

"use strict";

function isBlockTag(node) {
  return !!(node.body && node.body.children);
}

function hasElse(node) {
  return !!(node.else_ && node.else_.children);
}

function getOpenTagName(node) {
  return `${node.type.substring(0, 1).toLowerCase()}${node.type.substring(1)}`;
}

function getCloseTagName({ type }) {
  if (type === "AsyncAll" || type === "AsyncEach") {
    type = type.replace("Async", "");
  }

  return `end${type.toLowerCase()}`;
}

function buildValue(node) {
  if (node.type === "Literal" && !Number.isFinite(node.value)) {
    return `"${node.value}"`;
  }

  return node.value;
}

function getValue(node) {
  if (node.targets) {
    const left = node.targets.map(t => t.value).join(", ");
    const right = buildValue(node.value);

    return `${left} = ${right}`;
  }

  if (node.name) {
    let keys = node.name.value;

    if (node.name.children) {
      keys = node.name.children.map(item => item.value).join(", ");
    } else if (!node.arr) {
      return keys;
    }

    return `${keys} in ${node.arr.value}`;
  }

  if (node.template) {
    let extendsValue = "";

    switch (node.template.type) {
      case "Add":
        extendsValue = `${buildValue(node.template.left)} + ${buildValue(
          node.template.right
        )}`;
        break;
      default:
        extendsValue = buildValue(node.template);
    }

    if (node.ignoreMissing) {
      extendsValue = `${extendsValue} ignore missing`;
    }

    return extendsValue;
  }

  if (node.cond && node.cond.value) {
    return node.cond.value;
  }

  if (node.value && node.value.value) {
    return node.value.value;
  }

  return "---";
}

function isBuilderLine(part) {
  if (typeof part !== "object") {
    return false;
  }

  switch (part.type) {
    case "line":
    case "break-parent":
      return true;
    default:
      return false;
  }
}

module.exports = {
  isBlockTag,
  hasElse,
  getOpenTagName,
  getCloseTagName,
  getValue,
  isBuilderLine
};
