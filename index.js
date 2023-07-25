const express = require('express')
const app = express()
const cors = require('cors')
const mongoose = require('mongoose')
const bodyParser = require('body-parser')
require('dotenv').config()

mongoose.connect(process.env['MONGO_URI'], { useNewUrlParser: true, useUnifiedTopology: true })

let usersSchema = mongoose.Schema({
  username: String,
  log: [{
    description: String,
    duration: Number,
    date: String
  }]
})

let usersModel = mongoose.model("users", usersSchema)

const insertUser = (username, done) => {
  let user = new usersModel({username})
  user.save(function(err, data) {
    done(err, data)
  })
}

const insertExerciseInUser = (exercise, done) => {
  let id = (exercise[':_id']) ? mongoose.mongo.ObjectId(exercise[':_id']) : mongoose.mongo.ObjectId(exercise['_id'])
  let date = (exercise.date) ? new Date(exercise.date).toDateString() : new Date().toDateString()
  let ex = {description: exercise.description, duration: exercise.duration, date: date}
  usersModel.findById(id, function(err, user) {
    if (err) done(err) 
    else {
      if (!user) {
        insertUser('', function(err, data) {
          if (err) console.log(err)
          else {
            user = data
            let log = (user.log) ? user.log.map(e => {return {description: e.description, duration: e.duration, date: e.date}}) : []
        log.push(ex)
        usersModel.updateOne({_id: id}, {log: log}, function(err, data) {
          done(err, data)
        })
          }
        })
      } else {
        let log = (user.log) ? user.log.map(e => {return {description: e.description, duration: e.duration, date: e.date}}) : []
        log.push(ex)
        usersModel.updateOne({_id: id}, {log: log}, function(err, data) {
          done(err, data)
        })
      }
    }
  })
}

const allUsers = (done) => {
  usersModel.find({}, function(err, users) {
    done(err, users)
  })
}

const getUser = (userID, done) => {
  let id = mongoose.mongo.ObjectId(userID)
  usersModel.findById(id, function(err, usr) {
    done(err, usr)
  })
}



app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});
app.use(bodyParser.urlencoded({extended: false}))

app.route('/api/users').post(function(req, res) {
  insertUser(req.body.username, function(err, usr) {
    if (err) res.json({error: err})
    else res.json({username: usr.username, '_id': usr['_id']})
  })
}).get(function(req, res) {
  allUsers(function(err, users) {
    if (err) res.json({error: err})
    else {
      users = users.map(usr => {
        return {username: usr.username, '_id': usr['_id']}
      })
      res.json(users)
    }
  })
})


app.get(['/api/users//exercises', '/api/users/exercises'], function(req, res) {
  res.json({error: 'No ID informed'})
})

app.post('/api/users/:_id/exercises', function(req, res) {
  if (req.params['_id']) {
    insertExerciseInUser({...req.body, '_id': req.params['_id']}, function(err, data) {
      if (err) res.json({error: err})
      else {
        getUser(req.params['_id'], function(err, usr) {
          if (err) res.json({error: err})
          else {
            if(usr) {
              let lastLog = usr.log[usr.log.length - 1]
              res.json({username: usr.username, description: lastLog.description, duration: lastLog.duration, date: lastLog.date, '_id': usr['_id']})
            } else {
              res.json({username: '', description: '', duration: 0, date: new Date().toDateString(), '_id': 0})
            }
          }
        })
      }
    })
  } else {
    res.json({error: 'No ID informed'})
  }
})


app.get('/api/users/:_id/logs', function(req, res, next) {
  getUser(req.params['_id'], function(err, usr) {
    if (err) res.json({error: err})
    else {
      req.user = usr
      next()
    }
  })
}, function(req, res, next) {
  //from
  if (req.query.from) {
    try {
      let from = new Date(req.query.from)
      let log = req.user.log.filter(item => {
        let date = new Date(item.date)
        return from < date
      })
      req.user.log = log
    } catch (e) {
      console.log(e)
    }
  }
  
  //to
  if (req.query.to) {
    try {
      let to = new Date(req.query.to)
      let log = req.user.log.filter(item => {
        let date = new Date(item.date)
        return to > date
      })
      req.user.log = log
    } catch (e) {
        console.log(e)
    }
  }
  
  //limit
  if (req.query.limit) {
    try {
      let limit = req.query.limit
      req.user.log = req.user.log.slice(0, limit)
    } catch (e) {
      console.log(e)
    }
  }
  next()
}, function(req, res) {
  let user = req.user
  user.log = user.log.map(e => {
    return {
      description: e.description,
      duration: e.duration,
      date: new Date(e.date).toDateString()
    }
  })
  console.log(user.log.map(e => {return {date: e.date}}))
  res.json({
    username: user.username,
    count: user.log.length,
    _id: user['_id'],
    log: user.log
  })
})



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
