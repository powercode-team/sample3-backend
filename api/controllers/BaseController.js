const moment = require('moment');
const { serverConfig, userConfig }= require('../../config/index');

const TokenRepo = require('../repositories/token/TokenRepo');
const UserRepo = require('../repositories/user/UserRepo');

const responseErrors = require('../../config/responseMessages').error;

class BaseController {
  constructor(repo) {
    this.context = this;
    this.repo = repo;
  }

  static attachToBasePath( ...paths ) {
    return `${serverConfig.scheme}://${serverConfig.host}/${paths.join('/')}`
  }

  get try () { // Try-catch middleware wrapper
    return new Proxy( this.context, {
      // Intercept method getter
      get(target, name) {
        if (typeof target[name] === 'function') {
          return async function (req, res, next) {
            try {
              return await target[name].apply(target, [req, res, next])
            } catch (e) {
              next(e)
            }
          }
        }
        return target[name];
      }
    });
  }

  /*
   Base auth middlewares
  */
  async setRequestUser ( req, res, next ) {
    let authHeader = req.get('authorization');
    if ( authHeader ) {

      try {

        let token = await TokenRepo.getFirstBy({ ...serverConfig.baseAuthOptions(req), ...serverConfig.additionalAuthOptions(req) });

        if ( ! token ) {
          BaseController.responseUnauthorized( res );
        } else {

          req.user = await UserRepo.getFirstBy({ _id: token.user }).select('_id role email avatar');
          req.user.authHash = authHeader;

          // auto renew token lifetime
          await TokenRepo.updateOne({ hash : req.user.authHash }, { createdAt: moment() });
          next();
        }

      } catch ( error ) {
        BaseController.responseUnauthorized( res );
      }

    } else {
      next();
    }

  }

  /*
    Useful middlewares
  */
  checkRequestUser ( req, res, next ) {
    req.user ? next() : BaseController.responseUnauthorized( res );
  }

  validateProjectTime( comparisonExp, comparisionField, customCode = 403 ) {
    return ( req, res, next ) => {
      if ( comparisonExp( req.paramEntity[ comparisionField ] ) ) {
        next();
      } else
        BaseController.responseJSON( 403, res, { property : 'project date' }, customCode )
    }
  }

  isMeOrAdmin ( req, res, next ) {
    ( req.user && ( req.user.role === userConfig.roles.admin || req.user._id.toString() === req.params.id ) ) ?
      next() : BaseController.responseForbidden( res );
  }

  checkUserOwn ( req, res, next ) {
    ( req.user && req.paramEntity && req.user._id.toString()  === req.paramEntity.user.toString()  ) ? next() :
      BaseController.responseForbidden( res )
  }

  haveRolePermission ( roles ) {
    return ( req, res, next ) => ( req.user && roles.includes( req.user.role ) ) ? next() : BaseController.responseForbidden( res );
  }

  setParam ( select = '_id' ) { // Extend `select` fields if required
    return async ( req, res, next ) => {
      try {
        req.paramEntity = await this.repo.getFirstBase( { _id: req.params.id } ).select( select );
        req.paramEntity ? next() :
          BaseController.responseJSON( 404, res, { property: "param" }, req.errCodes ? req.errCodes[ 404 ] : 404 );
      } catch ( e ) {
        next(e)
      }
    }
  }

  parsePaginationParams ( req, res, next ) {
    // set pagination params for get request
    req.pagination = req.query ? {
      limit: +req.query.limit || 10,
      skip: +req.query.skip ||  0
    } : null;

    next();
  };

  /*
    Response methods
  */
  static responseJSON ( code, res, data,  customErrorHeaderCode = 0 ) {
    res.set('x-code-error',  customErrorHeaderCode );
    return res.status(code).json( data )
  }

  static responseValidationError ( res, property ) {
    res.set('x-code-error', res.errCodes ? res.errCodes[400] || 400 : 400 );
    return res.status(400).json({ error: { message: responseErrors.validationError, property } })
  }

  static responseUnauthorized ( res ) {
    res.set('x-code-error', res.errCodes ? res.errCodes[401] || 401 : 401 );
    return res.status(401).json({ error: { message: responseErrors.unauthorized } })
  }

  static responseForbidden ( res ) {
    res.set('x-code-error', res.errCodes ? res.errCodes[403] || 403 : 403 );
    return res.status(403).json({ error: { message: responseErrors.forbidden }})
  }

  static responseDuplicate ( res ) {
    res.set('x-code-error', res.errCodes ? res.errCodes[409] || 409 : 409 );
    return res.status(409).json({ error: { message: responseErrors.duplicatedResource }})
  }

  /*
   Attach socket server to controllers
 */
  static attachSocketService ( service ) {
    BaseController.SocketService = service;
  }

}

module.exports = BaseController;
