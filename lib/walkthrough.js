
exports.Walkthrough = function (empire) {
  var service = null;
  var table = null;

  this.run = function () {
    if (!empire.serviceSecrets) {
      console.log("Please connect some services in https://login.empiredata.co, and download the new JSON file");
      return;
    }

    var services = Object.keys(empire.serviceSecrets);
    walkthroughServices(services, function () {
      walkthroughMaterializedView(service, table)
    });
  };

  function walkthroughServices(services, callback) {
    service = services.shift();
    console.log("empire.connect('" + service + "');")
    empire.connect(service).success(function () {
      empire.describe(service).success(function (result) {
        var tables = result.service.tables.map(function (tableData) {
          return tableData.table;
        });

        if (service == 'mailchimp') {
          // These mailchimp tables can only be queried when filtering by a particular list.
          tables = tables.filter(function (t) {
            return t != 'list_member' && t != 'campaign' && t != 'campaign_sent_to' && t != 'campaign_opened';
          });
        }

        walkthroughTables(service, tables, function () {
          if (services.length > 0) {
            // keep going through services
            walkthroughServices(services, callback);
          } else {
            // no more services left - let's go to the next thing
            callback();
          }
        });
      });
    });
  }

  function walkthroughTables(service, tables, callback) {
    table = tables.shift();
    console.log("empire.query('SELECT * FROM "+service+"."+table+" LIMIT 5');");
    empire.query('SELECT * FROM '+service+'.'+table+' LIMIT 5')
    .forEach(printRow)
    .success(function () {
      if (tables.length > 0) {
        // keep going through tables
        walkthroughTables(service, tables, callback);
      } else {
        // no more tables left - let's go to the next thing
        callback();
      }
    });
  }

  function walkthroughMaterializedView(service, table) {
    if (!empire.enduser) {
      console.log("Please specify an enduser parameter when instantiating the client, so that you can try materialized views"); 
      return;
    }

    console.log("empire.materializeView('viewName', 'SELECT * FROM "+service+"."+table+" LIMIT 5').ready( function() {\n  empire.query('SELECT * FROM viewName LIMIT 5');\n});");
    empire.materializeView('viewName', "SELECT * FROM "+service+"."+table+" LIMIT 5").ready(function () {
      empire.query('SELECT * FROM viewName LIMIT 5')
      .forEach(printRow)
      .success(function () {
        console.log("empire.dropView('viewName');")
        empire.dropView('viewName');
      })
    });
  }

  function printRow(row) {
    var maxLength = 70;
    var fragment = JSON.stringify(row).slice(0, maxLength);
    if (fragment.length == maxLength) {
      fragment += "..."
    }
    console.log("   " + fragment);
  }
};