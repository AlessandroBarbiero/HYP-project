const express = require('express')
const app = express()
const { Sequelize, DataTypes, Op } = require('sequelize')
app.use(express.json())

// %%%%%%%%%%%%%% Development %%%%%%%%%%%%%%%%%
const database = new Sequelize(
  'postgres://postgres:postgres@localhost:5432/hyp',
  {
    define: {
      timestamps: false, // Remember to add something similar in the production part
    },
  }
)

// %%%%%%%%%%%%%%% Production (use this code when deploying to production in Heroku)  %%%%%%%%%%%%%%%%%%%%%
// const pg = require('pg')
// pg.defaults.ssl = true
// const database = new Sequelize(process.env.DATABASE_URL, {
//   ssl: true,
//   dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
// })

// Function that initialize the connection to the database, linking the tables with the objects used in sequelize
async function initializeDatabaseConnection() {
  await database.authenticate()

  const Events = database.define('events', {
    title: {
      type: DataTypes.STRING(100),
      unique: true,
    },
    description: DataTypes.TEXT,
    date: DataTypes.DATEONLY,
    ticket: DataTypes.REAL,
  })

  const Itineraries = database.define('itineraries', {
    title: {
      type: DataTypes.STRING(100),
      unique: true,
    },
    description: DataTypes.TEXT,
  })

  const Images = database.define('images', {
    path: DataTypes.STRING,
  })

  const Pois = database.define('pois', {
    title: {
      type: DataTypes.STRING(100),
      unique: true,
    },
    description: DataTypes.TEXT,
    opening_hours: DataTypes.TIME,
    closing_hours: DataTypes.TIME,
    ticket: DataTypes.REAL,
    address: DataTypes.STRING(100),
  })

  const Tags = database.define('tags', {
    tag: {
      type: DataTypes.STRING(50),
      unique: true,
    },
  })

  const ServicePoints = database.define('service_points', {
    name: {
      type: DataTypes.STRING(100),
      unique: true,
    },
    opening_hours: DataTypes.TIME,
    closing_hours: DataTypes.TIME,
    address: DataTypes.STRING(100),
  })

  const ServiceTypes = database.define('service_types', {
    name: {
      type: DataTypes.STRING(100),
      unique: true,
    },
    map: DataTypes.STRING(100),
    description: DataTypes.TEXT,
  })

  const Contacts = database.define('contacts', {
    landline_phone: DataTypes.STRING(20),
    mobile_phone: DataTypes.STRING(20),
    email: DataTypes.STRING(320),
  })

  Contacts.hasMany(Events)
  Events.belongsTo(Contacts)

  Events.belongsToMany(Tags, { through: 'events_tags' })
  Tags.belongsToMany(Events, { through: 'events_tags' })

  Itineraries.belongsToMany(Tags, { through: 'itineraries_tags' })
  Tags.belongsToMany(Itineraries, { through: 'itineraries_tags' })

  Events.belongsToMany(Pois, { through: 'host' })
  Pois.belongsToMany(Events, { through: 'host' })

  Itineraries.belongsToMany(Pois, { through: 'involve' })
  Pois.belongsToMany(Itineraries, { through: 'involve' })

  ServiceTypes.hasMany(ServicePoints)
  ServicePoints.belongsTo(ServiceTypes)

  Contacts.hasOne(ServicePoints)
  ServicePoints.belongsTo(Contacts)

  Images.hasOne(ServicePoints)
  ServicePoints.belongsTo(Images)

  Images.hasOne(ServiceTypes)
  ServiceTypes.belongsTo(Images)

  Images.belongsToMany(Pois, { through: 'pois_images' })
  Pois.belongsToMany(Images, { through: 'pois_images' })

  Images.belongsToMany(Events, { through: 'events_images' })
  Events.belongsToMany(Images, { through: 'events_images' })

  Images.hasOne(Itineraries)
  Itineraries.belongsTo(Images)

  Contacts.hasOne(Pois)
  Pois.belongsTo(Contacts)

  await database.sync({ force: false })
  return {
    Events,
    Itineraries,
    Images,
    Pois,
    Tags,
    ServicePoints,
    ServiceTypes,
    Contacts,
  }
}

// This storage is used for single pages
const pageContentObject = {
  index: {
    title: 'Homepage',
    image: '/images/extra/homepage.jpg',
    description: ``,
  },
  eventsType: {
    All: {
      title: 'All ' + new Date().getFullYear() + ' events',
      descrImg: '/images/events/event-types/yearevents.jpg',
      description:
        'Discover all the fantastic events organized in the city of Venice during this year.\n Choose your favorites and plan your visit to Venice so you can have an unforgettable experience.\n Take part in the Venetian tradition or get carried away by the uniqueness that new events bring to the lagoon every year.',
      linkName: 'Discover More',
      linkPath: '/events/event-types/year-events/' + new Date().getFullYear(),
    },
    Summer: {
      title: 'Summer Events',
      descrImg: '/images/events/event-types/summerevents.jpg',
      description:
        "During the summer, Venice is colored in the brightest colors. Summer events range from the film festival to the famous Vogalonga. Be inspired by the cheerfulness of Venetians and relax while watching the reflections of the sunset on the water of the lagoon. It's never too late to enjoy a vacation.",
      linkName: 'Discover More',
      linkPath: '/events/event-types/summer-events/all',
    },
    Winter: {
      title: 'Winter Events',
      descrImg: '/images/events/event-types/winterevents.jpg',
      description:
        'In winter, the lagoon is filled with magic. Events such as Carnival, exhibitions and the marathon make Venice even more unique and unforgettable. Not to mention that the sea of the lagoon offers natural shelter from the cold of winter. ',
      linkName: 'Discover More',
      linkPath: '/events/event-types/winter-events/all',
    },
  },
}

// ---------------------------------- API

async function runMainApi() {
  const models = await initializeDatabaseConnection()

  app.get('/page-info/:topic', (req, res) => {
    const { topic } = req.params
    const result = pageContentObject[topic]
    return res.json(result)
  })

  // %%%%%%%%%%%%%%%%%%%%%%%% POINTS OF INTEREST %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

  app.get('/points-of-interest', async (req, res) => {
    const result = await models.Pois.findAll({
      include: [
        {
          model: models.Images,
          attributes: ['path'],
        },
      ],
      order: [
        ['id', 'ASC'],
        [models.Images, 'id', 'ASC'],
      ],
    })
    const filtered = []
    for (const element of result) {
      filtered.push({
        id: element.id,
        title: element.title,
        images: element.images,
        linkPath: '/points-of-interest/' + element.title.replaceAll(' ', '-'),
      })
    }
    const data = filtered
    return res.json(data)
  })

  // %%%%%%%%%%%%%%%%%%%%%%%% SINGLE POINTS OF INTEREST %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
  app.get('/points-of-interest/:title', async (req, res) => {
    const { title } = req.params
    const titleMod = title.replaceAll('-', ' ')
    const poi = await models.Pois.findOne({
      where: {
        title: titleMod,
      },
      include: [
        {
          model: models.Images,
          attributes: ['path'],
        },
        {
          model: models.Events,
          attributes: ['title', 'description', 'date'],
          include: [{ model: models.Images, attributes: ['path'] }],
        },
        {
          model: models.Contacts,
          attributes: ['landline_phone', 'mobile_phone', 'email'],
        },
      ],
      order: [[models.Images, 'id', 'ASC']],
    })

    const data = poi

    return res.json(data)
  })

  // %%%%%%%%%%%%%%%%%%%%%% ITINERARIES %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
  app.get('/itineraries', async (req, res) => {
    const result = await models.Itineraries.findAll({
      include: [
        {
          model: models.Images,
          attributes: ['path'],
        },
      ],
    })

    const filtered = []
    for (const element of result) {
      let link = 'wip'
      if (element.description != null) {
        link = '/itineraries/' + element.title.replaceAll(' ', '-')
      }
      filtered.push({
        title: element.title,
        images: [element.image],
        description: element.description,
        linkPath: link,
      })
    }

    const data = filtered

    return res.json(data)
  })

  // %%%%%%%%%%%%%%%%%%%%% SINGLE-ITINERARY %%%%%%%%%%%%%%%%%%%%%%
  app.get('/itineraries/:title', async (req, res) => {
    const { title } = req.params
    const titleMod = title.replaceAll('-', ' ')

    const itinerary = await models.Itineraries.findOne({
      where: {
        title: titleMod,
      },
      include: [
        {
          model: models.Images,
          attributes: ['path'],
        },
        {
          model: models.Pois,
          attributes: ['title', 'description'],
          include: [{ model: models.Images, attributes: ['path'] }],
        },
      ],
    })

    const data = itinerary

    return res.json(data)
  })

  // %%%%%%%%%%%%%%%%%%%%% SERVICES %%%%%%%%%%%%%%%%%%%%%%
  app.get('/services', async (req, res) => {
    const result = await models.ServiceTypes.findAll({
      include: [
        {
          model: models.Images,
          attributes: ['path'],
        },
      ],
    })
    const filtered = []
    for (const element of result) {
      filtered.push({
        title: element.name,
        images: [element.image],
        linkPath: '/services/' + element.name.replaceAll(' ', '-'),
      })
    }
    const data = filtered

    return res.json(data)
  })

  // %%%%%%%%%%%%%%%%%%%%% SINGLE-SERVICE %%%%%%%%%%%%%%%%%%%%%%
  app.get('/services/:title', async (req, res) => {
    const { title } = req.params
    const titleMod = title.replaceAll('-', ' ')

    const mainService = await models.ServiceTypes.findOne({
      where: {
        name: titleMod,
      },
      attributes: ['name', 'map', 'description'],
      include: [
        {
          model: models.Images,
          attributes: ['path'],
        },
        {
          model: models.ServicePoints,
          include: [
            { model: models.Contacts, attributes: ['landline_phone'] },
            {
              model: models.Images,
              attributes: ['path'],
            },
          ],
        },
      ],
    })

    const data = mainService

    return res.json(data)
  })

  // %%%%%%%%%%%%%%%%%%%%%% EVENTS %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

  function sortImages(images) {
    return images.sort((a, b) =>
      a.path > b.path ? 1 : b.path > a.path ? -1 : 0
    )
  }

  function filterEventImages(result) {
    const filtered = {
      upcoming_events: [],
      all_events: [],
    }
    for (const element of result) {
      if (element.images.length) {
        element.images = sortImages(element.images)
      }
      const filteredElement = {
        title: element.title,
        description: element.description,
        date: element.date,
        ticket: element.ticket,
        images: element.images,
        linkPath: '/events/' + element.title.replaceAll(' ', '-'),
      }
      if (
        new Date(element.date) >= new Date() &&
        filtered.upcoming_events.length < 3
      ) {
        filtered.upcoming_events.push(filteredElement)
      }
      filtered.all_events.push(filteredElement)
    }

    return filtered
  }

  // %%%%%%%%%%%%%%%%%%%%%% SINGLE EVENT %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

  app.get('/events/:title', async (req, res) => {
    const { title } = req.params
    const titleMod = title.replaceAll('-', ' ')
    const event = await models.Events.findOne({
      where: {
        title: titleMod,
      },
      include: [
        {
          model: models.Images,
          attributes: ['path'],
        },
        {
          model: models.Pois,
          attributes: ['title', 'address'],
          include: [{ model: models.Images, attributes: ['path'] }],
        },
        {
          model: models.Contacts,
          attributes: ['landline_phone', 'mobile_phone', 'email'],
        },
      ],
    })

    event.images = sortImages(event.images)

    const data = event

    return res.json(data)
  })

  // HTTP GET api that returns the next 4 upcoming events
  app.get('/upcoming-events', async (req, res) => {
    const result = await models.Events.findAll({
      where: [
        {
          date: {
            [Op.gte]: new Date(),
          },
        },
      ],
      order: [['date', 'ASC']],
      limit: 4,
      include: [
        {
          model: models.Images,
          attributes: ['path'],
        },
      ],
    })

    const data = filterEventImages(result).upcoming_events

    return res.json(data)
  })

  // HTTP GET api that returns the events in the current year
  app.get('/year-events/:year', async (req, res) => {
    const { year } = req.params
    let result = ''
    let title = ''
    if (year === 'all') {
      title = 'All Events'
      result = await models.Events.findAll({
        order: [['date', 'ASC']],
        include: [
          {
            model: models.Images,
            attributes: ['path'],
          },
        ],
      })
    } else {
      title = 'All ' + year + ' Events'
      result = await models.Events.findAll({
        where: [
          {
            date: {
              [Op.gte]: new Date(year + '-01-01'),
              [Op.lte]: new Date(year + '-12-31'),
            },
          },
        ],
        order: [['date', 'ASC']],
        include: [
          {
            model: models.Images,
            attributes: ['path'],
          },
        ],
      })
    }
    const filtered = filterEventImages(result)
    const data = {
      title,
      description: pageContentObject.eventsType.All.description,
      bgImg: pageContentObject.eventsType.All.descrImg,
      upcoming_events: filtered.upcoming_events,
      all_events: filtered.all_events,
    }

    return res.json(data)
  })

  // HTTP GET api that returns the winter events
  app.get('/winter-events/all', async (req, res) => {
    const result = await models.Events.findAll({
      where: {
        [Op.or]: [
          Sequelize.where(
            Sequelize.fn('to_char', Sequelize.col('date'), 'MMDD'),
            { [Op.between]: ['0923', '1231'] }
          ),
          Sequelize.where(
            Sequelize.fn('to_char', Sequelize.col('date'), 'MMDD'),
            { [Op.between]: ['0101', '0321'] }
          ),
        ],
      },
      order: [['date', 'ASC']],
      include: [
        {
          model: models.Images,
          attributes: ['path'],
        },
      ],
    })

    const filtered = filterEventImages(result)

    const data = {
      title: pageContentObject.eventsType.Winter.title,
      description: pageContentObject.eventsType.Winter.description,
      bgImg: pageContentObject.eventsType.Winter.descrImg,
      upcoming_events: filtered.all_events.slice(0, 3),
      all_events: filtered.all_events,
    }

    return res.json(data)
  })

  // HTTP GET api that returns the summer events
  app.get('/summer-events/all', async (req, res) => {
    const result = await models.Events.findAll({
      where: Sequelize.where(
        Sequelize.fn('to_char', Sequelize.col('date'), 'MMDD'),
        { [Op.between]: ['0322', '0922'] }
      ),
      order: [['date', 'ASC']],
      include: [
        {
          model: models.Images,
          attributes: ['path'],
        },
      ],
    })
    const filtered = filterEventImages(result)
    const data = {
      title: pageContentObject.eventsType.Summer.title,
      description: pageContentObject.eventsType.Summer.description,
      bgImg: pageContentObject.eventsType.Summer.descrImg,
      upcoming_events: filtered.all_events.slice(0, 3),
      all_events: filtered.all_events,
    }

    return res.json(data)
  })

  // HTTP POST api, that will push (and therefore create) a new element in
  // our actual database
  /*   app.post('/cats', async (req, res) => {
    const { body } = req
    await models.Cat.create(body)
    return res.sendStatus(200)
  }) */
}

runMainApi()

export default app
