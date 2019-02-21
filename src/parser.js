/**
 * Nunjucks Parser
 */

"use strict";

const nunjucks = require("nunjucks/src/parser");
const ast = require("./ast");

// args: text, parsers, options
function parse(text) {
  // let node = ast.normalize(parser.parse(str));

  // if (opts && opts.verbose) {
  // 	node = ast.walk(node, n => {
  // 		n.parent = n.parent ? n.parent.type : null
  // 	});
  // } else if (opts && opts.clean === true) {
  // 	node = ast.clean(node);
  // }
  const nunjParsed = nunjucks.parse(text);
  return ast.normalize(nunjParsed);
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
