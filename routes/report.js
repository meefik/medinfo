var db = require('../db.js').db();
var mysql = require('mysql');

exports.add = function (req, res) {
    if (!req.session.username) {
        return res.send(401, "Unauthorized");
    }
    if (!req.body.callerid) {
        return res.send(400, "Bad Request");
    }
    db.query("INSERT INTO report (pickup, username, callerid) VALUES (NOW(),?,?)",
        [req.session.username, req.body.callerid],
        function (err, results) {
            if (!err) {
                res.json({ id: results.insertId });
            } else {
                res.send(406, "Not Acceptable");
                console.log(err);
            }
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
        db.query("UPDATE report SET hangup=NOW() WHERE id=? AND username=?",
            [req.params.questId, req.session.username],
            function (err, results) {
                if (!err) {
                    /*
                    db.query('SELECT TIMESTAMPDIFF(SECOND, pickup, hangup) AS duration FROM report WHERE id=?',
                        [req.params.questId],
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
                } else {
                    res.send(406, "Not Acceptable");
                    console.log(err);
                }
            }
        );
    } else {
        var key = mysql.escapeId(req.body.q_key);
        db.query("UPDATE report SET " + key + "=? WHERE id=? AND username=?",
            [req.body.q_value, req.params.questId, req.session.username],
            function (err, results) {
                if (!err) {
                    res.send(200, "OK");
                } else {
                    res.send(406, "Not Acceptable");
                    console.log(err);
                }
            }
        );
    }
}

exports.get = function (req, res) {
    if (!req.session.username) {
        return res.send(401, "Unauthorized");
    }
    var limit = parseInt(req.query.limit);
    if (!limit) limit = 1;
    db.query('SELECT * FROM report WHERE username=? ORDER BY id DESC LIMIT ?',
        [req.session.username, limit],
        function (err, rows) {
            if (!err && rows) {
                res.json(rows);
            } else {
                res.send(403, "Forbidden");
            }
        });
}
