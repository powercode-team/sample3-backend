const validate = require('express-joi-validation')({ passError: true });

const schemas = require('../joi/schemas');
const joiOptions = { joi: { abortEarly: false, stripUnknown: true } };

const ChannelController = require('../controllers/ChannelController');

module.exports = ( app ) => {

  app.get('/api/v1/channel',
    validate.query( schemas.pagination ),
    ChannelController.parsePaginationParams,
    ChannelController.setRequestUser,
    ChannelController.checkRequestUser,
    ChannelController.try.getAllChannels
  );

  app.post('/api/v1/message',
    validate.body( schemas.chat.messageCreate ),
    ChannelController.setRequestUser,
    ChannelController.checkRequestUser,
    ChannelController.try.sendMessage
  );


};
