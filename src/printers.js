/**
 * Nunjucks Prettier Printers
 */

const { concat, join, line, ifBreak, group } = require("prettier").doc.builders;

function print(path, options, print) {}

function embed(path, print, textToDoc, options) {}

module.exports = {
  "nunjucks-ast": {
    print,
    embed
  }
};
