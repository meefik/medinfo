var pool = require('../db.js').pool();

exports.login = function (req, res) {
    if (req.body.username && req.body.password) {
        pool.getConnection(function(err, connection) {
            connection.query('SELECT * FROM users WHERE username=? AND password=MD5(?)',
                [req.body.username, req.body.password],
                function (err, rows) {
                    if (!err && rows && rows.length > 0) {
                        req.session.username = rows[0].username;
                        req.session.sipconf = JSON.parse(rows[0].sipconf);
                        req.session.forward = JSON.parse(rows[0].forward);
                        res.send(200, "OK");
                    } else {
                        res.send(403, "Forbidden");
                    }
                    connection.end();
                });
        });
    } else {
        res.send(400, "Bad Request");
    }
}

exports.logout = function (req, res) {
    req.session.destroy(function(err){
        if (err) res.send(500, "Internal Server Error");
        else res.send(200, "OK");
    });

}

exports.profile = function (req, res) {
    if (!req.session.username) {
        return res.send(401, "Unauthorized");
    }
    res.json({"username": req.session.username, "sipconf": req.session.sipconf, "forward": req.session.forward});
}
