const moment = require('moment');
const htmlInput = require('joi-html-input');
const Joi = require('joi').extend(htmlInput);

Joi.objectId = require('joi-objectid')(Joi);

const configRoles = require('../../config/').userConfig.roles;

/**
 *  Joi constants
**/
const positiveJoi = Joi.number().integer().positive();
const regexJoi = ( pattern ) => Joi.string().regex( pattern );
const arrayJoi = ( element ) => Joi.array().items( element );

const arrayIdJoi = arrayJoi( Joi.objectId() );
const apiRoles = Joi.number().valid([ configRoles.business, configRoles.student, configRoles.donor, configRoles.nonProfit ]);
const joiEin = regexJoi(/^[1-9]\d?-\d{7}$/);
const passwordRegex = regexJoi(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,}$/);

module.exports = {
  user: {

    create: Joi.object( { // 2 - business, 3 - nonProfit, 4 - donor, 5 - student
      email: Joi.string().email().required(),
      role: Joi.number().valid( [ 2, 3, 4, 5 ] ).required(), // Defines which type of user we can create

      firstName: Joi.string().when( 'role', { is: [ 4, 5 ] , then: Joi.required(), otherwise: Joi.forbidden() } ),
      lastName: Joi.string().when( 'role', { is: [ 4, 5 ], then: Joi.required(), otherwise: Joi.forbidden() } ),
      birthDate: Joi.number().max( moment().subtract(16, 'years').unix() ).when( 'role', { is: [ 4, 5 ], then: Joi.required(), otherwise: Joi.forbidden() } ),


      companyName: Joi.string().when( 'role', { is: [ 2, 3 ], then: Joi.required(), otherwise: Joi.forbidden() } ),
      address: Joi.string().when( 'role', { is: [ 2, 3 ], then: Joi.required(), otherwise: Joi.forbidden() } ),

      school: Joi.objectId().when( 'role', { is: [ 5 ], then: Joi.required(), otherwise: Joi.forbidden() } ),

      ein: joiEin.when( 'role', { is: 3, then: Joi.required(), otherwise: Joi.forbidden() } ),
      billingAddress: Joi.string().when( 'role', { is: 3, then: Joi.required(), otherwise: Joi.forbidden() } ),

      gender: Joi.string().valid( [ 'male', 'female', 'other' ] ).when( 'role', {
        is: [ 4, 5 ],
        then: Joi.required(),
        otherwise: Joi.forbidden()
      }),
    }),

    update: Joi.object( { //potential bug without validate according to role
      firstName: Joi.string(),
      lastName: Joi.string(),
      birthDate: Joi.number().max( moment().subtract(16, 'years').unix() ),

      companyName: Joi.string(),
      address: Joi.string(),

      ein: joiEin,
      billingAddress: Joi.string(),

      school: Joi.objectId(),

      gender: Joi.string().valid( [ 'male', 'female', 'other' ] ),
    }),

    passwordChange: Joi.object({
      password: Joi.string().required(),
      newPassword: passwordRegex.required()
    }),

  },

  project: {

    getAll: Joi.object({
      type: Joi.number().valid( [ 0, 1, 2 ] ),
      sortDirection: Joi.number().valid([ 1, -1 ]),
      sortBy: Joi.string().valid(['createdAt']),
      createdBy: Joi.objectId(),
      isFollow: Joi.boolean(),
      skip: Joi.number().positive().allow(0),
      limit: positiveJoi
    }),

    create: Joi.object({ // 0 - volunteer, 1 - money, 2 - pickup
      title: Joi.string().required(),
      projectType: arrayJoi( Joi.number().valid( [ 0, 1, 2 ] )).required(),
      description: arrayJoi(Joi.object( {
        value: Joi.htmlInput().allowedTags().required(),
        type: Joi.number().valid( [ 0, 1 ] ).required()
      })).min(1),
      needs: arrayJoi(Joi.object( {
        value: Joi.string().required(),
        of: positiveJoi.required(),
        type: Joi.number().valid( [ 0, 1, 2 ] ).required()
      })).min(1),

      startDate: positiveJoi.min( moment().add(2, 'hours').unix()),
      endDate: positiveJoi.min( moment().add(2, 'hours').unix()),

      cover: Joi.string().required(),

      location: Joi.object( {
        geo: arrayJoi( Joi.number() ).length(2).required(),
        name: Joi.string().required()
      }).required(),

    }),

    update: Joi.object({  // potential bug without validate according to role
      title: Joi.string(),
      description: arrayJoi(Joi.object( {
        value: Joi.htmlInput().allowedTags().required(),
        type: Joi.number().valid( [ 0, 1 ] ).required()
      })),
      needs: arrayJoi(Joi.object({
        _id: Joi.objectId(),
        type: Joi.number().valid( [ 0, 1, 2 ] ),
        value: Joi.string(),
        of: positiveJoi
      })).min(1),

      startDate: positiveJoi,
      endDate: positiveJoi,

      location: Joi.object( {
        geo: arrayJoi( Joi.number() ).length(2).required(),
        name: Joi.string().required()
      }),

    }),

    participation: {
      params: Joi.object({
        id: Joi.objectId().required(),
        needId: Joi.objectId().required()
      }),

      body: Joi.object({ // 1 - confirm, 2 - reject
        status: positiveJoi.valid([ 1, 2 ]).required(),
        activeHours: Joi.number().min(0.1).when( 'status', { is: 1, then: Joi.required(), otherwise: Joi.forbidden() } ),
      }),

      requestParams: Joi.object({
        id: Joi.objectId().required(),
        requestId: Joi.objectId().required()
      })
    }
  },

};
