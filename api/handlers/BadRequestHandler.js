const prettifyJoiError = require('../helpers/prettifyJoiError');

const MongoError = require('mongoose').mongo.MongoError;
const ValidationError = require('mongoose').Error.ValidationError;

const responseErrors = require('../../config/responseMessages');

module.exports = (error, req, res, next) => {

  console.log('error ->> ', error ); // TODO : remove

  if ( error.error && error.error.isJoi ) {

    res.set('x-code-error', 400);

    res
      .status(400)
      .json({
        error: prettifyJoiError(error)
      });

  } else if ( error instanceof MongoError ) {

    if ( error.code === 11000 ) {

      res.set('x-code-error', res.errCodes ? res.errCodes[409] || 409 : 409 );

      res
        .status(409)
        .json({
          error: { message: responseErrors.error.duplicatedResource }
        });
    } else
      res.status( error && !! error.statusCode ? error.statusCode : 500 ).json({
        error: error && !! error.message ? { message: error.message }: { message: 'Mongodb error', details: error }
      });

  } else if ( error instanceof ValidationError ) {

    res.set('x-code-error', 400);

    res.status( 400 ).json({
      error: { message: error.message }
    });

  } else {

    res.set('x-code-error', error && !! error.statusCode ? error.statusCode : 500 );

    res.status( error && !! error.statusCode ? error.statusCode : 500 ).json({
      error: error && !! error.message ? { message: error.message }: { message: 'Unknown server error', details: error }
    });

  }
};
