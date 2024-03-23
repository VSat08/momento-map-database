const fs = require("fs");
const { validationResult } = require("express-validator");
const HttpError = require("../models/http-error");

const getCoordsForAddress = require("../util/location");

const Place = require("../models/place");

const User = require("../models/user");
const mongoose = require("mongoose");

//! GET Request: for places
const getPlaceById = async (req, res, next) => {
  const placeId = req.params.pid;

  let place;
  try {
    place = await Place.findById(placeId).exec();
  } catch (error) {
    return next(new HttpError("Maybe some error", 500));
  }

  if (!place) {
    return next(new HttpError("Could not find place for the provided ID", 404));
  }
  res.json({ place: place.toObject({ getters: true }) });
};

//! GET Request: for userPlaces
const getPlacesByUserId = async (req, res, next) => {
  const userId = req.params.uid;

  let places;
  try {
    // ?#######AN ALTERNATIVE APPROACH ====> UserWithPlaces = await Place.findById(userId).populate('places')####;

    places = await Place.find({ creator: userId }).exec();
  } catch (error) {
    return next(
      new HttpError(
        "Fetching places failed, please try again after some time",
        500
      )
    );
  }

  if (!places || places.length === 0) {
    return next(
      new HttpError(
        "Sorry....This user has'nt shared any places till now!",
        404
      )
    );
  }

  res.json({
    places: places.map((place) => place.toObject({ getters: true })),
  });
};

//! POST Request: for creating places
const createPlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid input passed, please check your data", 422)
    );
  }
  // extracting data from incoming request
  const { title, description, address } = req.body;

  let coordinates;

  try {
    coordinates = await getCoordsForAddress(address);
  } catch (err) {
    return next(err);
  }

  const createdPlace = new Place({
    title,
    description,
    address,
    location: coordinates,
    image: req.file.path,
    creator: req.userData.userId,
  });

  // checking that is user exists or not
  // If yes => we can create new place by that user
  let user;
  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    const error = new HttpError(
      "Creating Place Failed!, please try again later...",
      500
    );
    return next(error);
  }

  if (!user) {
    const error = new HttpError("Could not find User for provided Id", 404);
    return next(error);
  }

  // console.log(user);

  // saving the created place
  try {
    // session
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await createdPlace.save({ session: sess });
    user.places.push(createdPlace);
    await user.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    return next(new HttpError("Creating Place failed, please try again", 500));
  }

  res.status(201).json({ place: createdPlace });
};

//!PATCH Request: for Updating places
const updatePlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid input passed, please check your data", 422)
    );
  }

  const { title, description } = req.body;
  const placeId = req.params.pid;

  // const updatedPlace = { ...DUMMY_PLACES.find((p) => p.id === placeId) };
  // const placeIndex = DUMMY_PLACES.findIndex((p) => p.id === placeId);
  let place;
  try {
    place = await Place.findById(placeId).exec();
  } catch (err) {
    return next(
      new HttpError("Something went wrong, could not update place", 500)
    );
  }

  if (place.creator.toString() !== req.userData.userId) {
    return next(
      new HttpError("Warning: You are not allowed to edit this place!", 401)
    );
  }

  place.title = title;
  place.description = description;

  try {
    await place.save();
  } catch (err) {
    return next(
      new HttpError("Something went wrong, could not update place", 500)
    );
  }

  res.status(200).json({ place: place.toObject({ getters: true }) });
};

//!DELETE Request: for Deleting places
const deletePlace = async (req, res, next) => {
  const placeId = req.params.pid;

  let place;

  try {
    place = await Place.findById(placeId).populate("creator");
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not delete place.",
      500
    );
    return next(error);
  }

  if (!place) {
    const error = new HttpError("Could not find such place for this id", 404);
    return next(error);
  }

  if (place.creator.id !== req.userData.userId) {
    return next(
      new HttpError("Warning: You are not allowed to delete this place!", 401)
    );
  }

  const imagePath = place.image;

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await Place.deleteOne({ _id: place });
    place.creator.places.pull(place);
    place.creator.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not delete place.",
      500
    );
    return next(error);
  }

  fs.unlink(imagePath, (err) => {
    // console.log(err);
  });

  res.status(200).json({ message: "Deleted place." });
};

exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlace = updatePlace;
exports.deletePlace = deletePlace;
