const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const couponSchema = new Schema ({
    businessId : {type : String},
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', default: null }, 
    discount : { type : Number , required: true},
    detail : {type : String},
    startAt: { type: Date, default : Date.now}, 
    // EditAt: { type: Date, required: true , default : Date.now}, 
    endAt: { type: Date}, 
    
})

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;