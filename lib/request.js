if (typeof window === 'undefined') {
  var r = require; // hacky way to avoid loading unnecessary dependencies in browser
                   // TODO: figure out how browserify shims work
  var HttpRequest = r('xmlhttprequest').XMLHttpRequest;
} else {
  var HttpRequest = XMLHttpRequest;
}

// simple reimplementation of jQuery.extend
function extend(a, b){
  for(var key in b)
    if(b.hasOwnProperty(key))
      a[key] = b[key];
  return a;
}

exports.simpleHttpRequest = function (opts) {
  var request = new HttpRequest();
  request.open(opts.method, opts.url, true);
  for (header in opts.headers) {
    request.setRequestHeader(header, opts.headers[header]);
  }
  request.send(JSON.stringify(opts.body || {}));
  request.onreadystatechange = function() {
    if (request.readyState == 4) {
      if (request.status == 200)
        opts.success(request.responseText);
      else {
        if (opts.failure) {
          opts.failure(request.status, request.responseText);
        }
      }
    }
  };
}

exports.Request = function (empire, path, opts) {
  if (!opts) { opts = {}; }

  var self = this;

  var successHandler = function () {};
  this.success = function (handler) {
    successHandler = handler;
    return this;
  }

  var errorHandler = function (e) { throw new Error(e.body); };
  this.error = function (handler) {
    errorHandler = handler;
    return this;
  } 

  var customHandlers = {};
  if (opts.customHandlers) {
    for (event in opts.customHandlers) {
      this[event] = function (handler) {
        customHandlers[event] = handler;
        return self;
      }
    }
  }

  function withSessionKey(callback) {
    if (empire.sessionKey) {
      callback();
      return;
    }

    exports.simpleHttpRequest({
      'url': empire.baseUrl + "session/create" + (empire.enduser ? '?enduser=' + empire.enduser : ''),
      'method': 'post',
      'headers': {
        'Authorization': 'Empire appkey="' + empire.appKey + '"'
      },
      'body': {},
      'success': function (responseText) {
        response = JSON.parse(responseText);
        if (response['sessionkey']) {
          empire.sessionKey = response['sessionkey'];
          callback();
        } else if (response.status == 'error') {
          throwError('request', 200, responseText);
        }
      },
      'failure': function (status, responseText) {
        throwError('request', status, responseText);
      }
    });
  }

  function doRequest() {
    var defaultHeaders = {
      'Authorization': 'Empire sessionkey="' + empire.sessionKey + '"',
      'Content-Type': 'application/json',
      'Accept': '*/*' 
    };

    exports.simpleHttpRequest({
      'url': (opts.local ? '' : empire.baseUrl) + path,
      'method': opts.method || 'get',
      'headers': extend(defaultHeaders, opts.headers || {}),
      'body': opts.body || {},
      'success': function (responseText) {
        if (opts.raw) {
          var response = responseText;
        } else {
          try {
            var response = JSON.parse(responseText);
          } catch (e) {
            throwError('json', 200, responseText, e.message);
            return;
          }
        }

        if (response.status == 'error') {
          throwError('request', 200, responseText);
          return;
        }

        if (opts.filter) {
          response = opts.filter(response);
        }

        if (opts.customHandlers) {
          for (eventName in customHandlers) {
            var event = opts.customHandlers[eventName];
            var handler = customHandlers[eventName];
            event(handler, response);
          }
        }

        successHandler(response);
      },
      'failure': function (status, responseText) {
        throwError('request', status, responseText);
      }
    });
  }

  function throwError(type, statusCode, response, body) {
    if (!body) {
      // if response is JSON formatted, let's get the actual error text
      try {
        var body = JSON.parse(response).error;
      } catch (err) {
        var body = response;
      }
    }

    errorHandler({
      type: type,
      statusCode: statusCode,
      body: body,
      response: response
    });
  }

  withSessionKey(doRequest);
};