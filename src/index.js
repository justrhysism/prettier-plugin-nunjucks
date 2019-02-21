/**
 * Prettier Plugin Nunjucks
 */

"use strict";

const parser = require("./parser");
const printers = require("./printers");

module.exports = {
  options: {},
  defaultOptions: {},
  parsers: {
    nunjucks: parser
  },
  printers,
  languages: [
    {
      // The language name
      name: "Nunjucks",
      // Parsers that can parse this language.
      // This can be built-in parsers, or parsers you have contributed via this plugin.
      parsers: ["nunjucks"],
      extensions: [".njk", ".nunj"]
    }
  ]
};
