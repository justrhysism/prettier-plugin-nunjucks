/**
 * Nunjucks Parser
 */

"use strict";

const RemoteExtension = require("./extensions/custom-extension");
const nunjucks = require("nunjucks");
const ast = require("./ast");


const env = new nunjucks.Environment();
env.addExtension('RemoteExtension', new RemoteExtension());

// args: text, parsers, options
function parse(text) {
  const nunjParsed = nunjucks.parser.parse(text, env.extensionsList);
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
