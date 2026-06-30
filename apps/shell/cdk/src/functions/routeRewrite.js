function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (
    uri === "/core" ||
    uri.indexOf("/core/") === 0 && uri.indexOf(".") === -1
  ) {
    request.uri = "/index.html";
    return request;
  }

  if (
    uri === "/form-design" ||
    uri.indexOf("/form-design/") === 0 && uri.indexOf(".") === -1
  ) {
    request.uri = "/index.html";
    return request;
  }

  if (uri.indexOf(".") === -1) {
    request.uri = "/index.html";
  }

  return request;
}
