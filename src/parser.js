/**
 * Nunjucks Parser
 */

"use strict";

const nunjucks = require("nunjucks/src/parser");
const ast = require("./ast");

// args: text, parsers, options
function parse(text) {
  const nunjParsed = nunjucks.parse(text);
  const normalised = ast.normalize(nunjParsed);
  normalised.raw = text;
  return normalised;
}

function locStart(node) {
  // eslint-disable-next-line no-console
  console.log("locStart", node);
}

function locEnd(node) {
  // eslint-disable-next-line no-console
  console.log("locEnd", node);
}

// function hasPragma(text) {}

// function preprocess(text, options) {}

module.exports = {
  parse,
  // The name of the AST that
  astFormat: "nunjucks-ast",
  // hasPragma,
  locStart,
  locEnd
  //preprocess: preprocess
};
