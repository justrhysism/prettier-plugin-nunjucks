/**
 * Custom Extension to Test Custom Tags
 */

const nunjucks = require("nunjucks/src/parser");

/*
  Usage: (from nunjucks docs)

  {% remote "/stuff" %}
    This content will be replaced with the content from /stuff
  {% error %}
    There was an error fetching /stuff
  {% endremote %}
*/

function RemoteExtension() {
  this.tags = ["remote"];

  this.parse = function(parser, nodes, lexer) {
    // get the tag token
    var tok = parser.nextToken();

    // parse the args and move after the block end. passing true
    // as the second arg is required if there are no parentheses
    var args = parser.parseSignature(null, true);
    parser.advanceAfterBlockEnd(tok.value);

    // parse the body and possibly the error block, which is optional
    var body = parser.parseUntilBlocks("error", "endremote");
    var errorBody = null;

    if (parser.skipSymbol("error")) {
      parser.skip(lexer.TOKEN_BLOCK_END);
      errorBody = parser.parseUntilBlocks("endremote");
    }

    parser.advanceAfterBlockEnd();

    // See above for notes about CallExtension
    return new nodes.CallExtension(this, "run", args, [body, errorBody]);
  };

  this.run = function(context, url, body, errorBody) {
    var id = "el" + Math.floor(Math.random() * 10000);
    var ret = new nunjucks.runtime.SafeString(
      '<div id="' + id + '">' + body() + "</div>"
    );
    // var ajax = new XMLHttpRequest();
    //
    // ajax.onreadystatechange = function() {
    //   if(ajax.readyState == 4) {
    //     if(ajax.status == 200) {
    document.getElementById(id).innerHTML = url;
    //     }
    //     else {
    //       document.getElementById(id).innerHTML = errorBody();
    //     }
    //   }
    // };
    //
    // ajax.open('GET', url, true);
    // ajax.send();

    return ret;
  };
}

module.exports = RemoteExtension;
