// server.js

// set up ======================================================================
// get all the tools we need
var express  = require('express');
var app      = express();
var port     = process.env.PORT || 3000;
var mongoose = require('mongoose');
var passport = require('passport');
var flash    = require('connect-flash');

var morgan       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');
var session      = require('express-session');

var path = require('path');
var Primus = require('primus') ;
var Rooms = require('primus-rooms');


var configDB = require('./config/database.js');

// configuration ===============================================================
mongoose.connect(configDB.url); // connect to our database

require('./config/passport')(passport); // pass passport for configuration

// set up our express application
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.json()); // get information from html forms
app.use(bodyParser.urlencoded({ extended: true }));


app.set('view engine', 'ejs'); // set up ejs for templating

// required for passport
app.use(session({
    secret: 'ilovescotchscotchyscotchscotch', // session secret
    resave: true,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

// routes ======================================================================
require('./app/routes.js')(app, passport); // load our routes and pass in our app and fully configured passport
app.use(express.static(path.join(__dirname, 'public')));
// launch ======================================================================
var server = app.listen(port);
console.log('The magic happens on port ' + port);



//-----------------------------------------------------------------------------------------------------------
var allRoomsData = {} ;
var primus = new Primus(server, { transformer: "engine.io" });
primus.plugin('rooms', Rooms);
primus.save(__dirname +'/public/js'  +  '/primus.js');

primus.on("connection", function (spark) {
  console.log("Creating Connections");
  spark.on('data', function(data) {

  console.log("Data coming = " + JSON.stringify(data) ) ;
  data = data || {};
  var action = data.action;
  var room = data.room;
  var data = data.data;
  var joinUser  = data.user;

  // join a room
  if ('join' === action) {
    spark.join(room, function () {

      // send message to this client
      //spark.write('you joined room ' + room);
      console.log(joinUser + '::  You joined room : ' + room   );
      console.log(JSON.stringify(allRoomsData)) ;
      if(allRoomsData[room]) {
        //spark.room(room).except(spark.id).write({ action : 'update' , data : { pos : allRoomsData[room]}});
        spark.write({ action : 'update' , data : { pos : allRoomsData[room]}});
      }

      // send message to all clients except this one
      var joinMsg = { id : spark.id, msg : "Room Joined" + room } ;
      spark.room(room).except(spark.id).write(spark.id + ' joined room ' + room);
    });
  }

  // leave a room
  if ('leave' === action) {
    spark.leave(room, function () {

      // send message to this client
      spark.write('you left room ' + room);
    });
  }

  if(action == 'data') {
    spark.room(room).except(spark.id).write({ action : 'update' , data : { pos : data.pos, user : data.user}});
    allRoomsData[room] = data.pos;
  }

});
})

primus.on("disconnection", function (spark) {
    console.log("Conn disconnected. ") ;

})


console.log("Primus websockets serer is also started -> ") ;
