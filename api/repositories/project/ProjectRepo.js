const toObjectId = require('mongoose').Types.ObjectId;
const BaseRepo = require('../BaseRepo');

const Project = require('../../models/project/Project');
const FollowProject = require('../../models/project/FollowProject');
const Needs = require('../../models/project/Needs');

const aggregationStages = require('../MongoAggregationStage');

class ProjectRepo extends BaseRepo {
  constructor() {
    super(Project)
  }

  getBy( userId, match = {}, sort = { createdAt: -1 }, pagination ) { // Aggregate with follow status

    userId = userId ? toObjectId( userId ): userId;

    let primaryProjectFields = this.projectFields([
        '_id', 'projectType', 'title', 'isFollow', 'description', 'cover' ]),
    primaryUserFields = this.projectFields([ '_id', 'avatar', 'companyName', 'role' ]);

    let mainQuery = [
      { $match: match },
      { $sort: sort },
      { $skip: pagination.skip },
      { $limit: pagination.limit }
    ];

    if( userId ) { // optional lookup, which fires only if userId(auth) provided
      mainQuery.push( aggregationStages.lookupCompanyFollows( userId ) );
    }

    return Project.aggregate([
      ...mainQuery,
      aggregationStages.lookupUser(),
      {
        $addFields: {
          isFollow: userId ? { $anyElementTrue: [ "$lookupFollowing" ] } : false,
          user: { "$arrayElemAt": [ "$user", 0 ] }
        }
      },
      {
        $project: {
          ...primaryProjectFields,
          user: {
            ...primaryUserFields
          }
        }
      }
    ])
  }

  getFirstBy( userId, matchId ) {

    userId = userId ? toObjectId( userId ): userId;
    matchId = toObjectId( matchId );

    let primaryProjectFields = [ 'projectType', 'title', 'isFollow', 'description', 'address', 'cover',
      'startDate', 'endDate', 'location', 'createdAt' ],
      primaryUserFields = [ '_id', 'avatar', 'companyName', 'role' ];

    let mainQuery = [
      { $match: { _id: matchId } },
      aggregationStages.baseLookup('needs', '_id', 'project', 'needs'),
      {
        $unwind: {
          "path": "$needs",
          "preserveNullAndEmptyArrays": true
        }
      },
      { $sort: { "needs": 1 } },
      aggregationStages.baseLookup('needsparticipants', 'needs._id', 'need', 'participants'),
      { $addFields: {
          "needs.current":  { $sum : {
              $map: {
                "input": "$participants",
                // input: {
                //   "$filter": {
                //     "input": "$participants",
                //     "as": "el",
                //     "cond": { $eq: [ "$$el.status", 1 ] }
                //   }
                // }, TODO[v2] : pick-up or money
                as: "request",
                in: "$$request.value"
              }
            }
          }
        }
      },
      {
        $group: {
          _id: "$_id",
          ...this.groupFields( [ ...primaryProjectFields, 'user' ] ),
          needs: { $push: "$needs"},
        }
      },
    ];

    if( userId ) { // optional lookup, which fires only if userId(auth) provided
      mainQuery.push( aggregationStages.lookupCompanyFollows( userId ) );
      mainQuery.push( aggregationStages.lookupNeedParticipant( userId, matchId ) )
    }

    return Project.aggregate([
      ...mainQuery,
      aggregationStages.lookupUser(),
      {
        $addFields: {
          isFollow: userId ? { $anyElementTrue: [ "$lookupFollowing" ] } : false,
          user: { "$arrayElemAt": [ "$user", 0 ] }
        }
      },
      {
        $project: {
          ...this.projectFields( primaryProjectFields ),
          participation:  {
            $map:
              {
                input: "$participation",
                as: "participat",
                in: "$$participat.need"
              }
          },
          needs: {
            $cond: {
              if: { $eq: [ { $arrayElemAt: [ "$needs", 0 ] }, { "current": 0 } ] },
              then: [],
              else: "$needs"
            }
          },
          user: {
            ...this.projectFields( primaryUserFields )
          }
        }
      }
    ]).then( result => result[0])

  }

  getAllByFollows ( _id ) {
    return FollowProject.find({ follower: _id }, 'following');
  }

  following( body ) {
    return FollowProject.create( body );
  }

  unfollow( filter ) {
    return FollowProject.deleteOne( filter );
  }

  getNeedsForProject( project ) {
    return Needs.find({ project })
  }

  // validate needs. `Needs` must contains only `type` witch includes in projectType
  checkNeedValid ( needs, projectTypes ) {
    for (let need of needs ) {
      if ( need.type && !projectTypes.includes( need.type )) {
        return false;
      }
    }
    return true;
  }

}

module.exports = new ProjectRepo();

