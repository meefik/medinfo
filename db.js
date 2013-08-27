var mysql = require('mysql');
var db_conf = require('./dbconf.json');

var conn = mysql.createConnection(db_conf);
conn.connect(function(err) {
    if (err) {
        console.error("Error connection to database.");
    }
});

handleDisconnect(conn);

function handleDisconnect(client) {
    client.on('error', function (error) {
        if (!error.fatal) return;
        if (error.code !== 'PROTOCOL_CONNECTION_LOST') throw error;

        console.error('> Re-connecting lost MySQL connection: ' + error.stack);

        conn = mysql.createConnection(client.config);
        handleDisconnect(conn);
        conn.connect();
    });
};

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