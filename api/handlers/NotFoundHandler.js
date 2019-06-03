const config = require('../../config/responseMessages').error;

module.exports = ( req, res ) => {

  res.status(404).json({
    message: config.notFound
  });

};
