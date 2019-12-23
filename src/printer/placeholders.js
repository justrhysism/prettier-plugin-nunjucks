/**
 * Placeholder Functions
 */


const PLACEHOLDER_REGEX = /p\d+/;

function mapPlaceholders(templateArray, placeholderMap) {
  return templateArray.reduce((acc, token) => {
    const { type, value, placeholder, isFork, withinElement } = token;
    let { key } = token;

    if (type === "tag") {
      if (isFork) {
        const forkElements = placeholder.trim().split(" ");
        const forkElement1 = forkElements[0].trim();
        const forkElement2 = forkElements[1].trim();
        key = forkElement2.replace(">", "");

        placeholderMap.set(forkElement1, {
          print: "",
          isFork,
          withinElement
        });
      }

      placeholderMap.set(key, token);
      return acc + placeholder;
    }

    return acc + value;
  }, "");
}

module.exports = {
  PLACEHOLDER_REGEX,
  mapPlaceholders
};
