const mongoose = require('mongoose');
const mongoConfig = require('./index').mongoConfig;

const Mockgoose = require('mockgoose').Mockgoose;
const mockgoose = new Mockgoose(mongoose);

const populateFieldsPlugin = require('./plugins/populateFieldsPlugin');

module.exports = () => {

  mongoose.Promise = global.Promise;

  const dbURI = `mongodb://${ mongoConfig.username ? `${mongoConfig.username}:${mongoConfig.password}@`: ``}${mongoConfig.host}:${mongoConfig.port}/${mongoConfig.name}`;

  if( process.env.API_ENVIRONMENT === 'testing' ) {

    // mocking mongoose in memory
    mockgoose.prepareStorage().then(() => {
      mongoose.connect(dbURI, { useNewUrlParser: true, useCreateIndex: true }).catch(console.log);
    }).catch( err => { console.error(err); process.exit(0); });

  } else {

    mongoose.connection.on('connected', function () {
      console.log('Mongoose connection open to ' + dbURI);
    });

    mongoose.connection.on('error',function (err) {
      console.log('Mongoose connection error: ' + err);
    });

    mongoose.connection.on('disconnected', function () {
      console.log('Mongoose disconnected');
    });

    mongoose.connect(dbURI, { useNewUrlParser: true, useCreateIndex: true }).catch( err => { console.error(err); process.exit(0); });

  }

  process.on('SIGINT', function() {
    mongoose.connection.close(function () {
      console.log('Mongoose disconnected through app termination');
      process.exit(0);
    });
  });

  /*
    Configure mongoose plugins
  */
  mongoose.plugin( populateFieldsPlugin );

};
