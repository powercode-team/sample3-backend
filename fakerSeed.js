const request = require('request');
const fs = require('fs');
const os = require('os');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
const { promisify } = require('util');
const mkdirpAsync = promisify( mkdirp );
const rimrafAsync = promisify( rimraf );
const md5 = require('md5');
const faker = require('faker');
const moment = require('moment');
const mongoose = require('mongoose');

const baseSeed = require('./data/seed');
let schoolsId = [];

require('dotenv').config();

const { serverConfig, uploadsConfig, mongoConfig, userConfig, projectConfig } = require('./config/');
const userRoles = userConfig.roles;

const dbURI = `mongodb://${ mongoConfig.username ? `${mongoConfig.username}:${mongoConfig.password}@`: ``}${mongoConfig.host}:${mongoConfig.port}/${mongoConfig.name}`;
mongoose.connect(dbURI, { useNewUrlParser: true, useCreateIndex: true }).catch( err => { console.error(err); process.exit(0); });

const UserRepo = require('./api/repositories/user/UserRepo');
const User = require('./api/models/user/User');
const Needs = require('./api/models/project/Needs');
const School = require('./api/models/user/School');
const NeedsParticipant = require('./api/models/project/NeedsParticipant');
const ProjectRepo = require('./api/repositories/project/ProjectRepo');

const GENDERS = [
  0, // male
  1 // female
];

const STUDENTS_COUNT = process.argv[2] || 100;
const DONORS_COUNT = process.argv[3] || 40;
const NONPROFIT_COUNT = process.argv[4] || 20;

const TOTAL_USER_COUNT = STUDENTS_COUNT + DONORS_COUNT + NONPROFIT_COUNT + baseSeed.users.length;

const MAX_PROJECT_COUNT = 15; // projects per nonProfit
const MAX_NEEDS_COUNT = 8; // needs per projects
const MAX_NEEDS_PARTICIPANTS_COUNT = 25; // needs per projects
const PROJECT_TYPES = [ 0, 1 ]; // projects per nonProfit // TODO[v2]: add [0,1] type

const RANDOM_COVER_URL = 'https://picsum.photos/1920/640/?random';

function rand( from, to ) { return Math.floor( Math.random() * to ) + from; }

mongoose.connection.on('connected', async function () {

  try {

    console.log('Generate seed...');
    await generateSeed();
    console.log('Seed has been generated');

  } catch ( e ) {
    console.log('Error: ', e );
  } finally {
    mongoose.connection.close();
  }

});

async function generateSeed () {

  let schools = await School.find({}, '_id');

  if( schools.length === 0 ) {
    await School.create( require( './data/school' ) );
    schools = await School.find({}, '_id');
  }

  schoolsId = schools.map( el => el._id );

  /*
    Remove all data.
  */

  await rimrafAsync(`${os.homedir()}${uploadsConfig.fsPrefix}image/`);

  await UserRepo.deleteAll({});

  /*
    Seed users.
  */

  let avatarFilePath = `${os.homedir()}${uploadsConfig.fsPrefix}image/`;
  await mkdirpAsync( avatarFilePath );

  for ( let i = 0; i < baseSeed.users.length; i++ ) {
    const user = baseSeed.users[i];
    await UserRepo.createOne( await generateUsers( user, avatarFilePath, i ), user.password );
  }

  for ( let i = 0; i < NONPROFIT_COUNT; i++ ) {
    const user = { email: faker.internet.email(), role: 3 };
    await UserRepo.createOne( await generateUsers( user, avatarFilePath, i ), 'Qwerty123');
  }

  for ( let i = 0; i < STUDENTS_COUNT; i++ ) {
    const user = { email: faker.internet.email(), role: 5 };
    await UserRepo.createOne(
      await generateUsers( user, avatarFilePath,
      i,
      GENDERS[rand( 0, GENDERS.length )] ), 'Qwerty123'
    );
  }

  for ( let i = 0; i < DONORS_COUNT; i++ ) {
    const user = { email: faker.internet.email(), role: 4 };
    await UserRepo.createOne(
      await generateUsers( user, avatarFilePath,
        i,
        GENDERS[rand( 0, GENDERS.length )] ), 'Qwerty123'
    );
  }

  let usersId = await UserRepo.getBy({}).select('_id').lean();
  usersId = shuffle( usersId.map( el => el['_id']) );

  // Popularity users count
  let topUsers = Math.floor(0.05 * TOTAL_USER_COUNT);
  let upMiddleUsers = Math.floor(0.15 * TOTAL_USER_COUNT);
  let middleUsers = Math.floor(0.55 * TOTAL_USER_COUNT);
  let baseUsers = Math.floor(0.25 * TOTAL_USER_COUNT);

  await UserRepo.following([
    ...generateFollow( splitArray( usersId, 0, topUsers ), 0.85, 0.95 ),
    ...generateFollow( splitArray( usersId, topUsers, upMiddleUsers ), 0.50, 0.85 ),
    ...generateFollow( splitArray( usersId, upMiddleUsers, middleUsers ), 0.15, 0.50 ),
    ...generateFollow( splitArray( usersId, middleUsers, baseUsers ), 0.01, 0.15 )
  ]);


  /*
   Seed projects.
   */

  let coverFilePath = `${os.homedir()}${uploadsConfig.fsPrefix}image/`;
  await mkdirpAsync( coverFilePath );

  let nonProfitIds = await UserRepo.getBy({ role : 3 }).select('_id').lean();

  // Only 90 % have projects
  nonProfitIds = splitArray( shuffle( nonProfitIds.map( el => el._id )), 0, Math.floor( nonProfitIds.length * 0.90 ) ).slice;

  // Distribute projects count
  let topNonProfit = Math.floor(0.10 * nonProfitIds.length); // 10% with max possible project
  let middleNonProfit = Math.floor(0.25 * nonProfitIds.length); // 30% middle projects count
  let baseNonProfit = Math.floor(0.65 * nonProfitIds.length); // rest 60% poor projects count

  let topProject =  await generateProjects( splitArray( nonProfitIds, 0, topNonProfit ).slice, 0.8, 1, coverFilePath );
  let middleProjects =  await generateProjects( splitArray( nonProfitIds, topNonProfit, middleNonProfit ).slice, 0.3, 0.8, coverFilePath );
  let lowProjects =  await generateProjects( splitArray( nonProfitIds, middleNonProfit, baseNonProfit ).slice, 0, 0.3, coverFilePath );

  let projects = await ProjectRepo.createOne([ ...topProject, ...middleProjects, ...lowProjects ]);

  let participantsIds = await UserRepo.getBy({ $or:[{ role: userRoles.student },{ role: userRoles.donor } ]}).select('_id').lean();
  participantsIds = shuffle( participantsIds.map( el => el['_id']) );

  await generateProjectsNeeds( projects );

  await generateProjectsNeedsParticipants( projects, participantsIds );

  await ProjectRepo.following(
    await generateProjectsFollows( projects )
  );

  for ( let i = 0; i < baseSeed.pureUsers.length; i++ ) { // Generate users without any subscription or links
    const user = baseSeed.pureUsers[i];
    await UserRepo.createOne( await generateUsers( user, avatarFilePath, i ), user.password );
  }

  return true;


}

function generateFollow( splitedArr, fromUsersFollowPerc, toUsersFollowPerc ) {

  let follows = [];
  for ( let i = 0; i < splitedArr.slice.length; i++ ) { // Each user

    splitedArr.of = shuffle( splitedArr.of );
    let followerCount = getSizePercent ( fromUsersFollowPerc, toUsersFollowPerc, splitedArr.of.length );
    for ( let j = 0; j < followerCount; j++ ) { // Attach random followers

      follows.push({
        follower: splitedArr.of[j],
        following: splitedArr.slice[i]
      })

    }

  }
  return follows;

}

async function generateProjectsFollows ( projects ) {

  let following = [];
  for ( let i = 0; i < projects.length; i++ ) {
    const project = projects[ i ];

     let followers = await User.aggregate([
       {$match: { _id: { $ne: mongoose.Types.ObjectId(project.user) } }},
       { $sample: { size: rand( 0, TOTAL_USER_COUNT ) }  },
       { $project: { _id: 1 }  }
     ]);

    followers = followers.map( el => el._id );

    followers.forEach( follower => following.push({ follower: follower, following: project._id }));


  }

  return following;
}

async function generateProjectsNeeds( projects ) {

  for( const prj of projects ) {
    const projectType = prj.projectType;
    let needs = [];

    let count = rand( 1, MAX_NEEDS_COUNT );
    if ( projectType.length > 1 ) {
      for ( let i = 0; i < count * 2; i++ ) {
        needs.push({
          value: faker.random.word(),
          type: projectType[ rand( 0, 1) ],
          project: prj._id,
          of: prj.projectType.some( el => el === projectConfig.types.money ) ? Math.round(rand( 1, 10000 ) / 100) * 100 :
            Math.round(rand( 10, 150 ) / 10) * 10
        })
      }
    } else {
      for ( let i = 0; i < count; i++ ) {
        needs.push({
          value: faker.random.word(),
          project: prj._id,
          type: projectType[0],
          of: prj.projectType.some( el => el === projectConfig.types.money ) ? Math.round(rand( 1, 10000 ) / 100) * 100 :
            Math.round(rand( 10, 150 ) / 10) * 10
        });

      }

    }
    await Needs.create( needs ) ;
  }

}

async function generateProjectsNeedsParticipants( projects, participantsIds ) {

  let needsStatusTypes = Object.values( projectConfig.needsStatusTypes );

  for( const prj of projects ) {

    let needs = await ProjectRepo.getNeedsForProject(prj._id);
    let needsParticipant = [];

    for( const need of needs ) {
      if( Math.random() >= 0.35 ) { // 65% to be applied
        let partCount = rand( 1, MAX_NEEDS_PARTICIPANTS_COUNT);
        let isConfirmed = 1;
        for ( let i = 0; i < partCount; i++ ) {

          let status = needsStatusTypes[ rand( 0, needsStatusTypes.length ) ];
          if ( needsParticipant.length < participantsIds.length ) {
            needsParticipant.push( {
              project: prj._id,
              need: need._id,
              value: Math.floor( prj.projectType.some( el => el === projectConfig.types.money ) ?
                Math.round(rand( 1, 1000 ) / 10) * 10   : 1 ),
              status: status,
              ...status === projectConfig.needsStatusTypes.confirm && { activeHours: rand( 1, 8 ) + ( Math.random() > 0.8 ? 0.5 : 0 ) },
            } )
          }
        }

      }
    }

    participantsIds = shuffle(participantsIds);
    needsParticipant = shuffle(needsParticipant);

    for ( let i = 0; i < needsParticipant.length; i++ ) {
      needsParticipant[ i ].user =  participantsIds[ i ] ;
    }

    await NeedsParticipant.create( needsParticipant );

  }

}

async function generateProjects( splitedArr, countPercFrom, countPercTo, coverFilePath ) {

  let projects = [];

  for ( let i = 0; i < splitedArr.length; i++ ) { // Each user

    let projectCount = getSizePercent ( countPercFrom, countPercTo, MAX_PROJECT_COUNT );

    for ( let j = 0; j < projectCount; j++ ) {

      let name = `${md5( Date.now() + i )}.jpg`;
      const file = fs.createWriteStream( `${coverFilePath}/${name}` );
      await request( RANDOM_COVER_URL ).pipe( file );

      let projectType = PROJECT_TYPES[ rand( 0, PROJECT_TYPES.length ) ];

      let title = faker.company.bs();

      let startDate = faker.date.between( moment(), moment().add(7, 'days'));
      let endDate = faker.date.between( startDate, moment(startDate).add( rand( 1, 5 ), 'hours'));

      let data = faker.helpers.userCard();

      projectType = Array.isArray(projectType) ? projectType: [ projectType ];

      projects.push( {
        title: title.charAt(0).toUpperCase() + title.slice(1),
        projectType: projectType,
        user: splitedArr[i],
        address: `${data.address.street} ${data.address.city} ${data.address.zipcode}`,
        description: [ { type: 0, value: Math.random() >= 0.5 ? faker.lorem.paragraphs() : faker.lorem.sentence()  } ],
        cover: `${serverConfig.scheme}://${serverConfig.host}${uploadsConfig.httpPrefix}image/${name}`,
        startDate: moment(startDate).unix(),
        endDate: moment(endDate).unix(),
        location: {
          geo: [ data.address.geo.lng, data.address.geo.lat ],
          name: `${data.address.street} ${data.address.city}`
        }

      })

    }

  }
  return projects;

}

async function generateUsers( user, avatarFilePath, i = 0, gender = 0 ) {

    let name = `${md5( Date.now() + i )}.jpg`;
    const file = fs.createWriteStream( `${avatarFilePath}/${name}` );
    await request( faker.image.avatar() ).pipe( file );

    user = {
      email: user.email,
      role: user.role,
      companyName: [ userRoles.nonProfit, userRoles.business ].includes( user.role ) ? faker.company.companyName(): undefined,
      address: [ userRoles.nonProfit, userRoles.business ].includes( user.role ) ? `${faker.address.streetAddress()} ${faker.address.city()}`: undefined,
      ein: userRoles.nonProfit === user.role ? faker.phone.phoneNumber(`${ rand( 1, 9)  }#-#######`) : undefined,
      billingAddress: userRoles.nonProfit === user.role ? `${faker.address.streetAddress()} ${faker.address.city()} ${faker.address.state()} ${faker.address.zipCode()}`: undefined,
      firstName: [ userRoles.student, userRoles.donor ].includes( user.role ) ? faker.name.firstName(0): undefined,
      lastName:  [ userRoles.student, userRoles.donor ].includes( user.role ) ? faker.name.lastName(0) : undefined,
      school:  userRoles.student === user.role ? schoolsId[rand( 0, schoolsId.length )] : undefined,
      birthDate: [ userRoles.student, userRoles.donor ].includes( user.role ) ? moment( faker.date.between( moment([1970, 0, 1]),  moment().subtract(18, 'years'))).unix(): undefined ,
      gender: [ userRoles.student, userRoles.donor ].includes( user.role ) ? ['male', 'female'][ gender ]: undefined,
      avatar: `${serverConfig.scheme}://${serverConfig.host}${uploadsConfig.httpPrefix}image/${name}`
    };

    return user;
}

function splitArray ( arr, from, to ) {
  return ({
    of: [ ...arr.slice( 0, from ), ...arr.slice( to, arr.length ) ],
    slice: arr.slice( from, to )
  })
}

function getSizePercent ( minProc, maxProc, total ) {
  return Math.ceil(( Math.random() * (maxProc - minProc) + minProc) * total );
}

function shuffle(array) {
  let currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = rand( 0, currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

