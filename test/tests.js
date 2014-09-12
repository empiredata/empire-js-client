var nock = require('nock'),
    assert = require('assert'),
    fs = require('fs');
var Empire = require('../lib/empire.js').Empire;

RESPONSE_DESCRIBE_ALL = '{"status": "OK", "name": "salesforce"}';
RESPONSE_DESCRIBE_SALESFORCE = '{"status": "OK", "name": "salesforce", "tables": ["table1"]}';
RESPONSE_DESCRIBE_TABLE = '{"status": "OK", "name": "table1"}';
RESPONSE_ERROR = '{"error": "Something is broken"}';

var empire = new Empire('MOCK_USER', {
  enduser: 'MOCK_ENDUSER'
});

nock(empire.baseUrl)
    .persist()
    .post('/empire/session/create?enduser=MOCK_ENDUSER', {})
    .reply(200, '{"status": "OK", "sessionkey": "TESTSESSION"}')
    .get('/empire/services')
    .reply(200, RESPONSE_DESCRIBE_ALL)
    .get('/empire/services/salesforce')
    .reply(200, RESPONSE_DESCRIBE_SALESFORCE)
    .get('/empire/services/salesforce/table1')
    .reply(200, RESPONSE_DESCRIBE_TABLE)
    .get('/empire/services/salesforce/bad_table')
    .reply(500, RESPONSE_ERROR);

exports['connects to services'] = function () {
  var sf_data = {
    "access_token": "MOCK_ACCESS_TOKEN",
    "client_id": "MOCK_CLIENT",
    "refresh_token": "MOCK_REFRESH_TOKEN",
    "endpoint": "https://na15.salesforce.com"
  }

  var salesforce = nock(empire.baseUrl)
                       .post('/empire/services/salesforce/connect', sf_data)
                       .reply(200, {});

  empire.connect('salesforce', sf_data);

  this.on('exit', function () {
    salesforce.done();
  });
};

exports['describes all services'] = function () {
  var response = null;
  empire.describe().success(function (r) {
    response = r;
  });

  this.on('exit', function () {
    assert.eql(response, JSON.parse(RESPONSE_DESCRIBE_ALL));
  });
};

exports['describes a service'] = function () {
  var response = null;
  empire.describe('salesforce').success(function (r) {
    response = r;
  });

  this.on('exit', function () {
    assert.eql(response, JSON.parse(RESPONSE_DESCRIBE_SALESFORCE));
  });
};

exports['describes a table'] = function () {
  var response = null;
  empire.describe('salesforce', 'table1').success(function (r) {
    response = r;
  });

  this.on('exit', function () {
    assert.eql(response, JSON.parse(RESPONSE_DESCRIBE_TABLE));
  });
};

exports["doesn't describe a table without a service"] = function () {
  var exception = null;
  try {
    empire.describe(null, 'table1');
  } catch (e) {
    exception = e;
  }

  assert.equal(exception.message, 'Service must be specified if table is specified!');
};

exports["handles failure gracefully"] = function () {
  var error = null;
  empire.describe('salesforce', 'bad_table').error(function (e) {
    error = e;
  });

  this.on('exit', function () {
    assert.equal(error.body, JSON.parse(RESPONSE_ERROR).error);
  });
};

exports['runs queries'] = function () {
  var contents = null;
  var response = null;

  fs.readFile(process.cwd() + '/test/query_response_body.txt', 'utf8', function (err, data) {
    contents = data;

    var materialize = nock(empire.baseUrl)
                          .post('/empire/query', {'query': 'SELECT * FROM salesforce_account'})
                          .reply(200, data);

    empire.query('SELECT * FROM salesforce_account').success(function (r) {
      response = r;
    });
  });

  this.on('exit', function () {
    assert.isNotNull(response);
    assert.equal(response, contents);
  });
}

exports['creates views'] = function () {
  var materialize = nock(empire.baseUrl)
                        .put('/empire/view/viewName', {'query': 'SELECT QUERY'})
                        .reply(200, {});

  empire.materializeView('viewName', 'SELECT QUERY');

  this.on('exit', function () {
    materialize.done();
  });
}

exports['deletes views'] = function () {
  var deleteView = nock(empire.baseUrl)
                       .delete('/empire/view/viewName')
                       .reply(200, {});

  empire.dropView('viewName');

  this.on('exit', function () {
    deleteView.done();
  });
}
