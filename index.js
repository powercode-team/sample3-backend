'use strict';

require('dotenv').config();

const serverConfig = require( './config' ).serverConfig;
const express = require( 'express' );
const app = express();

/**
 * Setup Express Api.
 */
require( './config/express' )( app );

/**
 * Setup Database connection.
 */
require( './config/mongoose' )();

/**
 * Setup Socket IO connection. Attach io service to Controllers
 */
const { service } = require('./socket.io/');
require('./api/controllers/BaseController').attachSocketService(service);


/**
 * Setup Api routes
 */
const enableRoutes = require( './api/routes' );
const enableApiDocs = require( './config/swagger' );

/**
 * Enable 400+ request handlers
 */
const BadRequestHandler = require( './api/handlers/BadRequestHandler' );
const NotFoundHandler = require( './api/handlers/NotFoundHandler' );

enableApiDocs( app );
enableRoutes( app );

app.use( BadRequestHandler );
app.use( NotFoundHandler );

const memwatch = require('node-memwatch');
memwatch.on('leak', function(info) { console.error('Memory leak! Details :', info ) });

app.listen(serverConfig.port, () => {
  console.log( `Server was started at #${ serverConfig.port } port` );
});
