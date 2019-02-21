// From: https://raw.githubusercontent.com/shawnbot/meta-template/master/ast/index.js

"use strict";
const nodes = require("nunjucks/src/nodes");

const NODE_KEYS = [
  "args",
  "arr",
  "body",
  "cond",
  "expr",
  "else_",
  "left",
  "name",
  "right",
  "target",
  "template",
  "val",
  "value"
];

const CHILD_KEYS = ["children", "ops", "targets"];

const NODE_NAMES = Object.keys(nodes);

const getNodeType = node => {
  let type;
  return (
    node.type ||
    (NODE_NAMES.some(name => {
      if (node.constructor === nodes[name]) {
        return (type = name);
      }
    }),
    type)
  );
};

const normalize = node => {
  return walk(node, n => {
    n.type = getNodeType(n);
  });
};

const clean = node => {
  return walk(node, n => {
    delete n.lineno;
    delete n.colno;
    delete n.parent;
  });
};

const walk = (node, func) => {
  if (func(node) !== false) {
    CHILD_KEYS.filter(key => Array.isArray(node[key])).forEach(key => {
      node[key].forEach(child => walk(child, func));
    });

    NODE_KEYS.filter(key => node[key] && typeof node[key] === "object").forEach(
      key => walk(node[key], func)
    );
  }
  return node;
};

module.exports = {
  clean,
  normalize,
  getNodeType,
  walk
};
