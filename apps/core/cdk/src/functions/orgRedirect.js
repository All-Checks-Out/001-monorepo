function handler(event) {
  var request = event.request;
  var host = request.headers.host.value.toLowerCase();
  var uri = request.uri || "/";
  var querystring = request.querystring || {};
  var targetHost = "aco24.net";

  if (host === "testing.aco24.org") {
    targetHost = "testing.aco24.net";
  } else if (host === "staging.aco24.org") {
    targetHost = "staging.aco24.net";
  }

  var location = "https://" + targetHost;

  if (uri !== "/" || hasQuerystring(querystring)) {
    location += uri + serializeQuerystring(querystring);
  }

  return {
    statusCode: 301,
    statusDescription: "Moved Permanently",
    headers: {
      location: { value: location },
      "cache-control": { value: "max-age=3600" },
    },
  };
}

function hasQuerystring(querystring) {
  for (var key in querystring) {
    if (querystring.hasOwnProperty(key)) {
      return true;
    }
  }

  return false;
}

function serializeQuerystring(querystring) {
  var parts = [];

  for (var key in querystring) {
    if (querystring.hasOwnProperty(key)) {
      var value = querystring[key];

      if (value.multiValue) {
        for (var i = 0; i < value.multiValue.length; i++) {
          parts.push(key + "=" + value.multiValue[i].value);
        }
      } else {
        parts.push(key + "=" + value.value);
      }
    }
  }

  return parts.length === 0 ? "" : "?" + parts.join("&");
}
