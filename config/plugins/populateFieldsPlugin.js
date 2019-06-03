
const fieldsForPopulate = require('../../api/models/fieldsPopulate');

module.exports = (schema, options) => {

  schema.query.populateFields = async function( fields ) {
    let queryRes = await this;
    if ( queryRes ) {
      queryRes = queryRes.toObject();
      let promiseResult = await Promise.all( fields.split(' ').map( cur =>  fieldsForPopulate[cur] (queryRes) ));

      return { ...queryRes, ...promiseResult.reduce((acc,cur)=> ({ ...acc, ...cur }) ) }; // flat all fields
    }
  };
};