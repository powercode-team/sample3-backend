const BaseController = require('./BaseController');

const ProjectRepo = require('../repositories/project/ProjectRepo');
const NeedsParticipantsRepo = require('../repositories/project/NeedsParticipantsRepo');

let needsStatusTypes = require('../../config/index').projectConfig.needsStatusTypes;


class ProjectController extends BaseController {
  constructor() { super( ProjectRepo ) }

  /*
   Route handlers
  */
  async getProjectNeedRequests ( req, res ) {

    let users = await NeedsParticipantsRepo.getBy( {
      need: req.params.needId,
      project: req.params.id
    })
      .skip( req.pagination.skip )
      .limit( req.pagination.limit )
      .select('_id user status activeHours')
      .sort({ createAt: -1 })
      .populate( 'user', 'firstName lastName companyName avatar role' );

    BaseController.responseJSON( 200, res, users )

  }

  async applyToProjectNeed ( req, res ) {

    let projectNeeds = await ProjectRepo.getNeedsForProject( req.params.id );
    let filter = { project: req.params.id, user: req.user._id };

    if ( Array.isArray( projectNeeds ) && projectNeeds.some( need => need._id.toString() === req.params.needId ) ) {

      let participantRequest = await NeedsParticipantsRepo.getFirstBy( filter );
      if ( participantRequest ) { // switch = delete + apply
        await NeedsParticipantsRepo.deleteAll( { _id: participantRequest._id } );
      }

      // apply
      await NeedsParticipantsRepo.createOne( { ...filter, need: req.params.needId } );

      BaseController.responseJSON( 201, res, {} )

    } else
      BaseController.responseJSON( 404, res, { property: 'need' } )
  }

  async changeNeedRequestStatus ( req, res ) {

    await NeedsParticipantsRepo.updateOne({ _id: req.params.requestId, project: req.params.id }, {
      status: req.body.status,
      ... req.body.status === needsStatusTypes.reject && { $unset: { activeHours: "" } },
      ... req.body.status === needsStatusTypes.confirm && { activeHours: req.body.activeHours }
    });

    BaseController.responseJSON( 202, res, {} );

  }

  async refuseProjectApply ( req, res ) {

    let removed = await NeedsParticipantsRepo.deleteAll({ user: req.user._id, need: req.params.needId, project: req.params.id });

    BaseController.responseJSON( removed.n > 0 ? 202 : 404, res, {})

  }
}

module.exports = new ProjectController();
