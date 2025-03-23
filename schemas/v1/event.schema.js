const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const eventSchema = new Schema({
  businessId: { type: String },
  venueId: { type: Schema.Types.ObjectId, ref: 'Venue', default: null }, 
  location: {
    type: { type: String, enum: ["Point"], required: true },
    coordinates: { type: [Number], required: true }, 
    name: String,
    description: String,
  },
  name: { type: String, required: true },
  type: { type: String, enum: ["reward", "discount"] ,default: "" },
  imageUrl: [{ type: String }],
  detail: { type: String },
  startAt: { type: Date, default: Date.now },
  endAt: { type: Date },
  chatRoomId: [{ type: Schema.Types.ObjectId, ref: "ChatRoom" }],
  capacity: { type: Number, required: true },
  listofTableId: [{ type: Schema.Types.ObjectId, ref: 'Table' }],
  listCouponId: [{ type: Schema.Types.ObjectId, ref: 'Coupon' }],
  ongoing: { type: Boolean, default: false },
  tags: [String],
});


const Event = mongoose.model('Event', eventSchema);
module.exports = Event;
