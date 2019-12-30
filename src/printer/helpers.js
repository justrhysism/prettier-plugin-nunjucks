/**
 * Printer Helpers
 */

"use strict";

function escapeString(input) {
  if (typeof input === "string") {
    return input.replace(/\t/g, "\\t").replace(/\n/g, "\\n");
  }

  return input;
}

function isBlockTag(node) {
  return !!(node.body && node.body.children);
}

function hasElse(node) {
  return !!(node.else_ && node.else_.children);
}

function getOpenTagName(node) {
  let { type } = node;

  if (type === "FromImport") {
    type = "from";
  }

  return `${type.substring(0, 1).toLowerCase()}${type.substring(1)}`;
}

function getCloseTagName({ type }) {
  if (type === "AsyncAll" || type === "AsyncEach") {
    type = type.replace("Async", "");
  }

  return `end${type.toLowerCase()}`;
}

function buildVariable(node) {
  if (node.value || !node.val) {
    return buildValue(node);
  }

  const valIsNumber = Number.isInteger(node.val.value);
  const left = node.target ? buildVariable(node.target) : node.value;

  const useDot = node.val.type === "Literal" && !valIsNumber;

  const open = useDot ? "." : "[";
  const close = useDot ? "" : "]";

  const right = `${open}${node.val.value}${close}`;
  return `${left}${right}`;
}

function buildValue(node) {
  if (
    node.type === "Literal" &&
    !Number.isFinite(node.value) &&
    typeof node.value !== "boolean"
  ) {
    return `"${escapeString(node.value)}"`;
  }

  if (node.type === "Neg") {
    return `-${buildValue(node.target)}`;
  }

  return node.value;
}

function handleFilter(node) {
  if (node.type !== "Filter") {
    return buildVariable(node);
  }

  const filter = node.name.value;
  const filterArgs = node.args.children.splice(1).map(buildValue);
  const leftOfPipe = handleFilter(node.args.children[0]);

  const filterArgsRender = filterArgs.length
    ? `(${filterArgs.join(", ")})`
    : "";
  const rightOfPipe = `${filter}${filterArgsRender}`;
  return `${leftOfPipe} | ${rightOfPipe}`;
}

function getValue(node) {
  // Variable Filter
  // if (node.type === "Filter") {
  //   return handleFilter(node);
  // }

  // Set
  if (node.targets) {
    const left = node.targets.map(t => t.value).join(", ");
    const right = buildValue(node.value);

    return `${left} = ${right}`;
  }

  // For loop
  if (node.name) {
    let keys = node.name.value;

    if (node.name.children) {
      keys = node.name.children.map(item => item.value).join(", ");
    } else if (!node.arr) {
      return keys;
    }

    // Filter
    if (node.arr.type === "Filter") {
      node.arr.value = handleFilter(node.arr);
    }

    return `${keys} in ${node.arr.value}`;
  }

  // Extends
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
    } else if (node.target) {
      extendsValue = `${extendsValue} as ${node.target.value}`;
    } else if (node.names) {
      const keys = node.names.children.map(name => {
        if (typeof name.value === "string") {
          return name.value;
        }

        return `${name.key.value} as ${name.value.value}`;
      });

      extendsValue = `${extendsValue} import ${keys.join(", ")}`;
    }

    return extendsValue;
  }

  // If
  if (node.cond && node.cond.value) {
    return node.cond.value;
  }

  // Variable
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
  isBuilderLine,
  handleFilter,
  buildVariable
};
