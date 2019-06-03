module.exports = (app) => {

  return app.use( (req, res, next) => {

    res.setHeader('Access-Control-Allow-Origin',  req.get('Origin') || '*' );
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Expose-Headers', 'x-code-error');
    res.setHeader('Access-Control-Allow-Headers', 'x-confirm-token, x-timezone, x-requested-with, content-type, authorization');
    res.setHeader('Access-Control-Allow-Credentials', true );

    if ( req.method === 'OPTIONS' ) {

      res.status(204).end();

    } else {

      next();

    }

  });

};
