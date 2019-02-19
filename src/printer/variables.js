/**
 * Variable Printers
 */

const DELIMITER_OPEN = "{{";
const DELIMITER_CLOSE = "}}";

function buildVariable(node) {
  if (node.value) return node.value;

  const valIsNumber = Number.isInteger(node.val.value);
  let left = node.target ? buildVariable(node.target) : node.value;

  const useDot = node.val.type === "Literal" && !valIsNumber;

  const open = useDot ? "." : "[";
  const close = useDot ? "" : "]";

  let right = `${open}${node.val.value}${close}`;
  return `${left}${right}`;
}

function printVariable(node) {
  let variable = "";

  switch (node.type) {
    case "Symbol":
      variable = node.value;
      break;
    case "LookupVal":
      variable = buildVariable(node);
      break;
  }

  return `${DELIMITER_OPEN} ${variable} ${DELIMITER_CLOSE}`;
}

module.exports = {
  printVariable
};
