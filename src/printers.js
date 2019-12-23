/**
 * Nunjucks Prettier Printers
 */

"use strict";

const { printVariable } = require("./printer/variables");
const {
  isBlockTag,
  hasElse,
  getOpenTagName,
  getCloseTagName,
  getValue,
  isBuilderLine
} = require("./printer/helpers");
const { mapRestoreTags } = require('./printer/restore');
const { mapPlaceholders } = require('./printer/placeholders');

const { concat, dedent, hardline } = require("prettier").doc.builders;
const { mapDoc } = require("prettier").doc.utils;

let hoistedTextToDoc;

// args: path, options, print
function print(path) {
  const parsedArray = path.stack[0];
  // 1. Need to find all Nunjucks nodes and replace them with placeholders.
  // 2. Run the place-held doc through the HTML formatter.
  // 3. Upon return, re-instate the Nunjucks template tags with formatting.

  const placeholderMap = new Map();

  // 1. Install placeholders.
  const placeheldString = mapPlaceholders(parsedArray, placeholderMap);

  // 2. Run through HTML formatter.
  const htmlDoc = hoistedTextToDoc(placeheldString, { parser: "html" });

  // 3. Restore Tags.
  const callback = mapRestoreTags(placeholderMap);
  return mapDoc(htmlDoc, callback);
}

// args: path, print, textToDoc, options
function embed(path, print, textToDoc) {
  hoistedTextToDoc = textToDoc;
  return null;
}

module.exports = {
  "nunjucks-ast": {
    print,
    embed
  }
};
