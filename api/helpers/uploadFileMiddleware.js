const fs = require('fs');
const os = require('os');
const mkdirp = require('mkdirp');
const md5 = require('md5');
const Busboy = require('busboy');

const { serverConfig, uploadsConfig } = require('../../config/index');

module.exports = ( store ) => ( req, res, next ) => {

  let busboy;

  try {

    busboy = new Busboy( { headers: req.headers } );

    if ( !busboy ) throw new Error('File Upload fails: incorrect headers sent')

  } catch ( e ) {
    e.statusCode = 404;
    next(e)
  }

  busboy.on( 'file', async ( fieldname, file, filename, encoding, mimetype ) => {

    if (  fieldname && uploadsConfig.acceptedMimeTypes.indexOf( mimetype ) >= 0 ) {

      let name = `${md5( Date.now() )}.${mimetype.split( '/' )[ 1 ]}`;

      req.files = req.files || {};
      req.files[ fieldname ] = `${serverConfig.scheme}://${serverConfig.host}${uploadsConfig.httpPrefix}image/${name}`; // TODO: remove hardcoded image

      let mainFilePath = `${os.homedir()}${uploadsConfig.fsPrefix}${store}`;
      mkdirp( mainFilePath, function ( err ) { // creates directory recursive
        if(err) console.log('File dir error: ', err );

        file.pipe( fs.createWriteStream( `${mainFilePath}/${name}` ) );

      });

    } else {
      let typeError = new Error(`${uploadsConfig.fileTypeError} : ${mimetype}`);
      typeError.statusCode = 422;
      next( typeError );
    }

  });

  busboy.on( 'finish', function () {
    next();
  });

  return req.pipe( busboy );

};
