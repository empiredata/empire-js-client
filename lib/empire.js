var Request = require('./request.js').Request;
var Walkthrough = require('./walkthrough.js').Walkthrough;

/**
 * app_key is your Empire application key, and is necessary for using the API
 * opts can include any of:
 *      'api_server' : the server to connect to (default: api.empiredata.com)
 *      'enduser' : a string identifying the end user, required for any operations on views (default: nil)
 *      'secrets' : a JSON object generated by https://login.empiredata.co (default: nil)
 *      'secretsJson' : the path to a JSON file generated by https://login.empiredata.co (default: nil)
 */
exports.Empire = function(appKey, opts) {
  var self = this;

  function initialize() {
    if (!opts) { opts = {}; }

    var apiServer = opts['apiServer'] || 'api.empiredata.co';

    self.appKey = appKey;
    self.enduser = opts['enduser'];
    self.sessionKey = '';

    var protocol = (apiServer.indexOf('localhost') > -1) ? 'http' : 'https';
    self.baseUrl = protocol + '://' + apiServer + '/empire/';

    self.serviceSecrets = null;
    if (opts['secrets']) {
      self.serviceSecrets = opts['secrets'];
    }
  }

  /**
   * Load secrets from a JSON file
   * (this operation is async in browser and sync in node, but the interface is identical)
   * file: the path to the JSON secrets file
   * event handlers: .ready(), .error({type, statusCode, body})
   */
  self.loadSecrets = function (file) {
    if (typeof window === 'undefined') {
      // in node - load secrets synchronously
      self.serviceSecrets = require(process.cwd() + '/' + file);
      return {
        'ready': function (handler) {
          handler();
        }
      };
    } else {
      // in browser - load secrets asynchroously
      return new Request(self, file, {
        local: true,
        customHandlers: {
          'ready': function (handler, response) {
            self.serviceSecrets = response;
            self.isReady = true;
            handler();
          }
        }
      });
    }
  }

  /**
   * Connect to specific service
   * service: service name
   * secrets: object with service secrets (optional if the Empire instance was initialized with a secrets JSON file)
   * event handlers: .success(response), .error({type, statusCode, body})
   */
  self.connect = function (service, secrets) {
    if (!secrets) {
      secrets = {};
      for (k in self.serviceSecrets[service].option) {
        v = self.serviceSecrets[service].option[k];
        secrets[k] = v.value;
      }
    }

    return new Request(self, "services/" + service + "/connect", {
      method: 'post',
      body: secrets
    });
  };

  /**
   * Describe all services, all tables within a given service, or a given table
   * event handlers: .success(response), .error({type, statusCode, body})
   */
  self.describe = function (service, table) {
    var path = "services";
    if (service) {
      path += "/" + service;
      if (table) {
        path += "/" + table;
      }
    } else if (table) {
      throw new Error("Service must be specified if table is specified!");
    }

    return new Request(self, path);
  };

  /**
   * Print the result of an SQL query
   */
  self.printQuery = function (sql) {
    self.query(sql).forEach(function (row) {
      console.log(row);
    });
  };

  /**
   * Issue an SQL query
   * event handlers: .forEach(row), .success(response), .error({type, statusCode, body})
   */
  self.query = function (sql) {
    return new Request(self, "query", {
      method: 'post',
      body: {'query': sql},
      raw: true,
      customHandlers: {
        'forEach': function (handler, response) {
          response.split('\n').forEach (function (row) {
            if (row != '') {
              handler(JSON.parse(row));
            }
          })
        }
      }
    });
  };

  /**
   * Insert a new row into this service table. The row should be an object of {column: value}
   * event handlers: .success(response), .error({type, statusCode, body})
   */
  self.insert = function (service, table, row) {
    return new Request(self, "services/" + service + "/" + table, {
      method: 'post',
      body: row
    });
  };

  /**
   * Materialize a SQL query as a view. This creates or updates a view.
   * event handlers: .ready(), .error({type, statusCode, body})
   */
   self.materializeView = function (name, sql) {
    if (!self.enduser) {
      throw new Error("Cannot use a materialized view within a session initiated without an enduser")
    }

    return new Request(self, "view/" + name, {
      method: 'put',
      body: {'query': sql},
      customHandlers: {
        'ready': function (handler) {
          waitUntilViewIsReady(name, handler, 100);
        }
      }
    });
  };

  /**
   * Delete a materialized view of SQL query.
   * event handlers: .success(response), .error({type, statusCode, body})
   */
  self.dropView = function (name) {
    if (!self.enduser) {
      throw new Error("Cannot use a materialized view within a session initiated without an enduser")
    }

    return new Request(self, "view/" + name, {
      method: 'delete'
    });
  };

  /**
   * Queries the Date that this view was materialized at (or null, if the materialization is currently pending).
   * event handlers: .success(date), .error({type, statusCode, body})
   */
  self.viewMaterializedAt = function (name) {
    if (!self.enduser) {
      throw new Error("Cannot use a materialized view within a session initiated without an enduser")
    }

    return new Request(self, "view/" + name + "/status", {
      filter: function (response) {
        try {
          return new Date(response['materializedAt']);
        } catch (e) {
          return null;
        }
      }
    });
  }

  /**
   * Run automatic test of all services from JSON
   */
  self.walkthrough = function () {
    new Walkthrough(self).run();
  };

  function waitUntilViewIsReady(name, callback, interval) {
    new Request(self, "view/" + name + "/status").success(function (result) {
      if (result['viewStatus'] == 'ready') {
        callback();
      } else if (result['viewStatus'] == 'pending') {
        setTimeout(function () {
          waitUntilViewIsReady(name, callback, interval) // (interval is in ms)
        }, interval);
      }
    });
  }

  initialize();
};

if (typeof window !== 'undefined') {
  window.Empire = exports.Empire;
}
