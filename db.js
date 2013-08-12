var mysql = require('mysql');
var db_conf = require('./dbconf.json');
var conn = mysql.createConnection(db_conf);

conn.connect(function(err) {
    if (err) {
        console.log("Error connection to database.");
    }
});

exports.db = function() {
    return conn;
}

/*
exports.db = function() {
    var conn = mysql.createConnection(db_conf);
    conn.connect(function(err) {
        if (err) {
            console.log("Error connection to database.");
        }
    });
    return conn;
}
*/