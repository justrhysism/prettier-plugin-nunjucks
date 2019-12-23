/**
 * Nunjucks Parser
 */

"use strict";

// const RemoteExtension = require("./extensions/custom-extension");
// const nunjucks = require("nunjucks");
// const ast = require("./ast");

const mustache = require("mustache");

// const env = new nunjucks.Environment();
// env.addExtension('RemoteExtension', new RemoteExtension());

function buildPlaceholderTag(id, withinElement, type, nextId) {
  const pid = `p${id}`;
  const keepLine = type === TAG_INLINE || type === TAG_FORK;

  const tagOpenStartChar = withinElement ? "o$" : keepLine ? "<" : "\n<";
  const tagOpenEndChar = withinElement ? " " : keepLine ? "/> " : ">\n";
  const tagCloseStartChar = withinElement ? " c$" : `\n</`;

  let placeholder = "";
  let key = "";

  switch (type) {
    case TAG_END:
      placeholder = `${tagCloseStartChar}${pid}${tagOpenEndChar}`;
      key = placeholder.trim();
      break;
    case TAG_FORK:
      const nextPid = `p${nextId}`;
      placeholder = `${tagCloseStartChar}${pid}${tagOpenEndChar.replace('/', '')}${tagOpenStartChar}${nextPid}${tagOpenEndChar.replace('/', '')}`;
      key = `${tagCloseStartChar}${pid}${tagOpenEndChar.replace('/', '')}`.trim();
      break;
    default:
      placeholder = `${tagOpenStartChar}${pid}${tagOpenEndChar}`;
      key = `${tagOpenStartChar}${pid}`.trim();
  }

  return {
    placeholder,
    key
  };
}

const TAG_INLINE = 0;
const TAG_BLOCK = 1;
const TAG_END = 2;
const TAG_FORK = 3;

const TAG_MAP = new Map([
  ["set", TAG_INLINE],
  ["else", TAG_FORK],
  ["elseif", TAG_FORK],
  ["elif", TAG_FORK],
]);

let placeholderId = 0;

// args: text, parsers, options
function parse(text) {
  // const nunjParsed = nunjucks.parser.parse(text, env.extensionsList);
  const mustacheParsed = mustache.parse(text, ["{%", "%}"]);

  const tagStack = [];
  let latestText = "";

  // TODO: Split out
  // Handle tags
  const parsedArray = mustacheParsed.map(
    ([type, value, start, end], index, array) => {
      const token = {
        type,
        value,
        start,
        end
      };

      if (type === "text") {
        latestText = value;
      } else if (type === "name") {
        // TODO: Solidify
        const tagName = value.split(" ")[0];

        let tagType = tagName.startsWith("end")
          ? TAG_END
          : TAG_MAP.get(tagName);
        if (tagType === undefined) tagType = TAG_BLOCK;

        let tagId;
        let nextId;

        const lastTagStartChar = latestText.lastIndexOf("<");
        const lastTagEndChar = latestText.lastIndexOf(">");
        let withinElement = lastTagStartChar > lastTagEndChar;

        if (tagType === TAG_END || tagType === TAG_FORK) {
          const offStackTag = tagStack.pop();
          tagId = offStackTag.tagId;
          withinElement = offStackTag.withinElement;

          if (tagType === TAG_FORK) {
            nextId = placeholderId++;
          }
        } else {
          tagId = placeholderId++
        }

        const tagLength = end - start;

        const { placeholder, key } = buildPlaceholderTag(
          tagId,
          withinElement,
          tagType,
          nextId
        );

        token.type = "tag";
        token.tag = tagName;
        token.tagId = nextId || tagId;
        token.tagType = tagType;
        token.placeholder = placeholder;
        token.key = key;
        token.withinElement = withinElement;
        token.isFork = tagType === TAG_FORK;
        // TODO: Rewrite value
        token.print = `{% ${value} %}`; // TODO: Use configured tags

        if (tagType === TAG_BLOCK || tagType === TAG_FORK) {
          tagStack.push(token);
        }
      }

      return token;
    }
  );

  // const normalised = ast.normalize(nunjParsed);
  // normalised.raw = text;
  return parsedArray;
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
