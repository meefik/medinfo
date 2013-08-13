/**
 * Module dependencies.
 */

var express = require('express')
    , routes = require('./routes')
    , user = require('./routes/user')
    , report = require('./routes/report')
    , http = require('http')
    , path = require('path')
    , MySQLStore = require('connect-mysql')(express)
    , db = require('./db.js').db();

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
//app.set('views', __dirname + '/views');
//app.set('view engine', 'jade');
//app.set("view options", {layout: false});
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser());
app.use(express.session({
    secret: 'b8529d8386074185df9090361f0d1cac',
    store: new MySQLStore({ client: db, cleanup: false })
}));
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}

//app.get('/', routes.index);
app.post('/api/login', user.login);
app.get('/api/logout', user.logout);
app.get('/api/profile', user.profile);
app.post('/api/report', report.add);
app.get('/api/report', report.get);
app.post('/api/report/:reportId', report.update);

http.createServer(app).listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});
