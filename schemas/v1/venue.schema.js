const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const venueSchema = new Schema ({
  businessId : {type : String},
  name : { type : String , required : true},
  nameTH : { type : String , required : true},
  nameEN : { type : String , required : true},
  location: {
    type: { type: String, enum: ["Point"], required: true },
    coordinates: { type: [Number], required: true }, 
    name: String,
    description: String,
  },
  image : [{type : String}],
  type : {
      type: String,
      required: true,
      enum: ["Nightclub", "Bar" , "Restaurant" , "Food", "Activity"],
  },
  eventListID : [{ type: String }],
  tableListID : [{ type : String }],
  reviewStar: {type: Number,},
  reviewCount: {type: Number},
    
})

const Venue = mongoose.model('Venue', venueSchema);

module.exports = Venue;