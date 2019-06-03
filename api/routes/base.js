const EmailSubscription = require( '../models/user/EmailSubscription' );

module.exports = ( app ) => {

  app.get('/api/v1/landing-requests', async ( req, res, next ) => {
    try {
      res.status( 200 ).json( await EmailSubscription.find() ); // TODO[v2]: pagination or remove
    } catch ( e ) { next(e) }
  });

};
