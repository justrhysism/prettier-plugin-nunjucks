/**
 * Variable Printers
 */

"use strict";

const { handleFilter, buildVariable } = require("./helpers");
const DELIMITER_OPEN = "{{";
const DELIMITER_CLOSE = "}}";

function printVariable(node) {
  let variable = "";

  switch (node.type) {
    case "Symbol":
      variable = node.value;
      break;
    case "LookupVal":
      variable = buildVariable(node);
      break;
    case "Filter":
      variable = handleFilter(node);
      break;
  }

  return `${DELIMITER_OPEN} ${variable} ${DELIMITER_CLOSE}`;
}

module.exports = {
  printVariable
};
