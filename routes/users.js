const express = require('express')
const router = express.Router()

const passport = require('passport')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')

const User = require('../models/user')

const env = require('dotenv').config().parsed

// @route  POST users/signup
// @desc   Create An User
// @acces  Public
router.post('/signup', (req, res, next) => {
  const {email, username, password} = req.body
  const hashedPassword = hashPassword(password)

  const newUser = new User({email, username, password: hashedPassword, following: [], followers: [], profile_photo: ''})

  newUser.save((err, user) => {
    if(err) res.json({success: false, msg: 'Failed to register user'})
    else res.json({success: true, msg: 'User registered'})
  })
})

// @route  POST users/login
// @desc   Login user returning JWT to frontend
// @acces  Public
router.post('/login', async (req, res, next) => {
  const {username, password} = req.body
  
  // Getting user by username
  const user = await User.findOne({$or:[{username: username}, {email: username}]})
  if(!user) return res.json({success: false, msg: 'User not found'})

  // Checking password
  const isMatch = await bcrypt.compare(password, user.password)
  if(!isMatch) return res.json({success: false, msg: 'Wrong password'})  

  // Loging In
  const token = jwt.sign({data: user}, env.SECRET, { expiresIn: 60 * 60 * 24 * 7})


  // Response with user info and token
  res.json({
    success: true,
    token: `Bearer ${token}`,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
    },
  })
})

// @route  GET users/profile/:username
// @desc   Get User Profile
// @acces  Public
router.get('/profile/:username', passport.authenticate('jwt', {session:false}) ,(req, res, next) => {
  const {username} = req.params
  User.findOne({username})
  .then(user => res.json({user, success: true}))
  .catch(err => res.statusCode(404).json({success:false, msg: err}))
})

// @route  PUT users/follow/:username
// @desc   Follow a user
// @acces  Authenticated
router.put('/follow/:username', passport.authenticate('jwt', {session:false}) ,async (req, res, next) => {
  const {username} = req.params
  const {_id} = req.body

  // Get both users. Followed and follower
  try {
    const followedUser = await User.findOne({username})
    const followerUser = await User.findOne({_id})
  
    // Check if already follows user
    const alreadyFollows = followerUser.following.find((val, idx) => val.username = followedUser.username)
    if(alreadyFollows) res.json({success: false, msg: 'You already follow this user'})
    else {
    // Update following and followers
    const updatedFollowed = await followedUser.updateOne({$push: {followers: {
      username: followerUser.username,
      profile_photo: followerUser.profile_photo,
    }}})

    const updatedFollowing = await followerUser.updateOne({$push: {following: {
      username: followedUser.username,
      profile_photo: followedUser.profile_photo,
    }}})
    
    // Send successful response whether both users have been updated correctly
    if(updatedFollowed && updatedFollowing) res.json({success: true})
    else res.json({success: false})
  }
} catch (error) {
  res.status(404).json({success:false, err: error})
}
})


// @route  PUT users/unfollow/:username
// @desc   Unfollow user
// @acces  Authenticated
router.put('/unfollow/:username', passport.authenticate('jwt', {session:false}) , async (req, res, next) => {
  const {username} = req.params
  const {_id} = req.body

  const unfollowedUser = await User.findOne({username})
  const unfollowerUser = await User.findOne({_id})
  // Check if users are exist
  if(!unfollowedUser || !unfollowerUser) res.json({success:false})

  // Remove user from followers
  unfollowedUser.followers = unfollowedUser.followers.filter(val => val.username != unfollowerUser.username)
  unfollowedUser.save((err, doc) => {
    if(err) {
      res.json({success: false, err})
      return
    }
  })
  
  // Remove user from followed
  unfollowerUser.following = unfollowerUser.following.filter(val => val.username != unfollowedUser.username)
  unfollowerUser.save((err, doc) => {
    if(err) res.json({success: false, err: err})
    else res.json({success: true})
  })
})

router.put('/updateEmail/:username', passport.authenticate('jwt', {session:false}) ,(req, res, next) => {
  const {username} = req.params
  const {email} = req.body
  User.updateOne({username}, {$set: {email}})
  .then(user => res.json({user, success: true}))
  .catch(err => res.json({success:false, msg: err}))
})

router.get('/usernameAvailable/:username', () => {
  const {username} = req.params
  User.findOne({username})
  .then(user => res.json({available: true}))
  .catch(err => res.json({available: false}))
})


function hashPassword (password) {
  const rounds = 10
  const hashedPassword = bcrypt.hashSync(password, rounds)
  return hashedPassword
}

module.exports = router