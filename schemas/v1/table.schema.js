const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const tableSchema = new Schema({
    businessId : {type : String},
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', default: null }, 
    number : { type : String , required: true},
    capacity : { type : Number , require: true},
    detail : { type : String},
})

const Table = mongoose.model('Table', tableSchema);

module.exports = Table;