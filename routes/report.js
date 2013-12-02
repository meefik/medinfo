var pool = require('../db.js').pool();
var mysql = require('mysql');
var http = require('http');

function startMedsys(username, callerid) {
    var url = '/call1.php?user_id=' + username + '&phone_num=' + callerid + '&action=start';
    var options = {
        host: '1220-test.cito.ee',
        port: 80,
        path: url,
        method: 'GET'
    }
    var callback = function(response) {
        console.log("startMedsys ["+response.statusCode+"]: "+url);
    }
    http.request(options, callback).end();
}

function endMedsys(username, reportid) {
    var url = '/call1.php?user_id=' + username + '&ext_call_id=' + reportid + '&action=end';
    var options = {
        host: '1220-test.cito.ee',
        port: 80,
        path: url,
        method: 'GET'
    }
    var callback = function(response) {
        console.log("endMedsys ["+response.statusCode+"]: "+url);
    }
    http.request(options, callback).end();
}

function dataMedsys(username, q_key, q_value) {
    var key, value;
    if (q_key === "q_gender") {
        var q_gender = ["", "Мужчина", "Женщина"];
        key = "gender";
        value = q_gender.indexOf(q_value);
    }
    if (q_key === "q_age") {
        var q_age = ["", "до 1 года", "от 1 до 5 лет", "от 6 до 15 лет", "от 16 до 29 лет", "от 30 до 39 лет", "от 40 до 59 лет", "больше 60 лет"];
        key = "age";
        value = q_age.indexOf(q_value);
    }
    if (typeof key === 'undefined' || typeof value === 'undefined') {
        return;
    }
    var url = '/call1.php?user_id=' + username + '&' + key + '=' + value + '&action=data';
    var options = {
        host: '1220-test.cito.ee',
        port: 80,
        path: url,
        method: 'GET'
    }
    var callback = function(response) {
        console.log("dataMedsys ["+response.statusCode+"]: "+url);
    }
    http.request(options, callback).end();
}

exports.add = function (req, res) {
    if (!req.session.username) {
        return res.send(401, "Unauthorized");
    }
    if (!req.body.callerid) {
        return res.send(400, "Bad Request");
    }
    pool.getConnection(function(err, connection) {
        connection.query("INSERT INTO report (pickup, username, callerid) VALUES (NOW(),?,?)",
            [req.session.username, req.body.callerid],
            function (err, results) {
                if (!err) {
                    res.json({ id: results.insertId });
                    startMedsys(req.session.username, req.body.callerid);
                } else {
                    res.send(406, "Not Acceptable");
                    console.log(err);
                }
                connection.release();
            });
    });
}

exports.update = function (req, res) {
    if (!req.session.username) {
        return res.send(401, "Unauthorized");
    }
    if (!req.body.q_key) {
        return res.send(400, "Bad Request");
    }
    if (req.body.q_key === 'hangup') {
        pool.getConnection(function(err, connection) {
            connection.query("UPDATE report SET hangup=NOW() WHERE id=? AND username=?",
                [req.params.reportId, req.session.username],
                function (err, results) {
                    if (!err) {
                        /*
                         connection.query('SELECT TIMESTAMPDIFF(SECOND, pickup, hangup) AS duration FROM report WHERE id=?',
                         [req.params.reportId],
                         function (err, rows) {
                         if (!err && rows && rows.length > 0) {
                         res.json({ duration: rows[0].duration });
                         } else {
                         res.json({ duration: -1 });
                         }
                         }
                         );
                         */
                        res.send(200, "OK");
                        endMedsys(req.session.username, req.params.reportId);
                    } else {
                        res.send(406, "Not Acceptable");
                        console.log(err);
                    }
                    connection.release();
                }
            );
        });
    } else {
        var key = mysql.escapeId(req.body.q_key);
        pool.getConnection(function(err, connection) {
            connection.query("UPDATE report SET " + key + "=? WHERE id=? AND username=?",
                [req.body.q_value, req.params.reportId, req.session.username],
                function (err, results) {
                    if (!err) {
                        res.send(200, "OK");
                    } else {
                        res.send(406, "Not Acceptable");
                        console.log(err);
                    }
                    connection.release();
                }
            );
        });
        dataMedsys(req.session.username, req.body.q_key, req.body.q_value);
    }
}

exports.get = function (req, res) {
    if (!req.session.username) {
        return res.send(401, "Unauthorized");
    }
    var limit = parseInt(req.query.limit);
    if (!limit) limit = 1;
    pool.getConnection(function(err, connection) {
        connection.query('SELECT * FROM report WHERE username=? ORDER BY id DESC LIMIT ?',
            [req.session.username, limit],
            function (err, rows) {
                if (!err && rows) {
                    res.json(rows);
                } else {
                    res.send(403, "Forbidden");
                }
                connection.release();
            });
    });
}
