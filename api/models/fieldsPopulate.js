const mongoose = require('mongoose');
const Project = require('./project/Project');
const FollowUser = require('./user/FollowUser');
const NeedsParticipant = require('./project/NeedsParticipant');

const userRoles = require('../../config/index').userConfig.roles;

const populateField = ( field, expr, method ) => {
  return ( data ) => expr(data) ? method(data).then( res => ({ [`${field}`]: res })) : {}
};

module.exports = {
  'projectsCount': populateField(
    'projectsCount',
    ( user ) => [ userRoles.nonProfit ].includes( user.role ),
    ( user ) => Project.countDocuments({ user: user._id })
  ),
  'volunteerActivity': populateField(
    'volunteerActivity',
    ( user ) => [ userRoles.donor, userRoles.student ].includes( user.role ),
    ( user ) => NeedsParticipant.aggregate([
      { $match: { user: mongoose.Types.ObjectId( user._id ) } },
      { $group: { _id: null, sum: { $sum: "$activeHours" } } }
    ]).then( res => res[0] && res[0].sum )
  ),
  'followersCount': populateField(
    'followersCount',
    () => true,
    ( user ) => FollowUser.countDocuments( { following: user._id } )
  ),
  'followingCount': populateField(
    'followingCount',
    () => true,
    ( user ) => FollowUser.countDocuments( { follower: user._id } )
  )
};