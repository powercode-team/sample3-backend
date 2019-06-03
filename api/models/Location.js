const mongoose = require('mongoose');

const LocationSchema = new mongoose.Schema({

  geo: {
    type: [ Number ], // [ longitude, latitude ]
    index: '2dsphere',
  },

  name: {
    type: String
  }

}, {
  versionKey: false,
  toObject: { getters: true },
  toJSON: { getters: true },
  id: false
});

module.exports = LocationSchema;
