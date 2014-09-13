if (typeof Empire === 'undefined') {
  var Empire = require('empire').Empire;
}

var appId = (typeof process !== 'undefined') ? process.argv[2] : location.hash.split("#")[1];

var empire = new Empire(appId, {
  'enduser': 'enduser_handle'
});

empire.loadSecrets('/empire_service_secrets.json').ready(function () {
  empire.walkthrough();
});