/**
 * Options Definition
 */

const CATEGORY_NUNJUCKS = "Nunjucks";

module.exports = {
  blockTags: {
    since: null,
    category: CATEGORY_NUNJUCKS,
    type: "string",
    array: true,
    default: [{ value: [] }]
  },
  inlineTags: {
    since: null,
    category: CATEGORY_NUNJUCKS,
    type: "string",
    array: true,
    default: [{ value: [] }]
  },
  forkTags: {
    since: null,
    category: CATEGORY_NUNJUCKS,
    type: "string",
    array: true,
    default: [{ value: [] }]
  }
};
