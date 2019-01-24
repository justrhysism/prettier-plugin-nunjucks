/**
 * Nunjucks Parser
 */

const nunjucks = require("nunjucks/src/parser");
const ast = require("./ast");

function parse(text, parsers, options) {
  // let node = ast.normalize(parser.parse(str));

  // if (opts && opts.verbose) {
  // 	node = ast.walk(node, n => {
  // 		n.parent = n.parent ? n.parent.type : null
  // 	});
  // } else if (opts && opts.clean === true) {
  // 	node = ast.clean(node);
  // }
  const parsed = ast.normalize(nunjucks.parse(text));
  return parsed;
}

function locStart(node) {
  console.log("locStart", node);
}

function locEnd(node) {
  console.log("locEnd", node);
}

function hasPragma(text) {}

function preprocess(text, options) {}

module.exports = {
  parse: parse,
  // The name of the AST that
  astFormat: "nunjucks-ast",
  hasPragma: hasPragma,
  locStart: locStart,
  locEnd: locEnd
  //preprocess: preprocess
};
